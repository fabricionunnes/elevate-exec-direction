import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// Vigia da API da Anthropic. Em 27/08/2026 o credito acabou e 90 edge functions +
// 18 crons pararam em silencio por dois dias. Este check faz a chamada mais barata
// possivel e avisa o Fabricio no WhatsApp no mesmo dia.
// Nao avisa de novo antes de 12h, e avisa tambem quando volta. Desde 07/10/2026 roda a cada
// 30 min (cron ai-health-30min) e avisa pelo Marcelo e pelo Fabricio Nunnes.
// Desde 16/10/2026 vigia tambem a transcricao de audio dos agentes (vigiaTranscricao).

const FONE = "5531989840003";        // Fabricio
const ANTI_SPAM_HORAS = 12;

// Mesmo dialeto do resumo-diario-gestao: Evolution na VPS usa /message/sendText/{instancia},
// Stevo (manager_v2) usa /send/text. As instancias migraram para Evolution em 08/2026 —
// filtrar por manager_v2 deixa o alerta mudo, que e o que aconteceu com o check_inbox_silence.
const COLS = "instance_name, api_url, api_key, status, provider_type";

// Envia pelas DUAS instâncias: Marcelo (o Fabrício lê os avisos do Marcelo) e Fabrício Nunnes.
// Em 06/10/2026 o aviso saiu só pelo Fabrício Nunnes e passou batido: a IA ficou 3h muda
// sem ninguém saber. Devolve "enviado" se pelo menos uma saiu.
const INSTANCIAS = ["marceloalmeida", "fabricionunnes"];
async function zapUma(sb: any, instName: string, texto: string) {
  const { data: inst } = await sb.from("whatsapp_instances").select(COLS).eq("instance_name", instName).eq("status", "connected").maybeSingle();
  if (!inst?.api_url || !inst?.api_key) return instName + ": sem instancia conectada";
  let host = "";
  try { host = new URL(inst.api_url).hostname.toLowerCase(); } catch { /* url torta: assume evolution */ }
  const isV2 = inst.provider_type === "manager_v2" || host.endsWith(".stevo.chat");
  const url = isV2
    ? `${inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "")}/send/text`
    : `${inst.api_url.replace(/\/+$/g, "")}/message/sendText/${inst.instance_name}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: inst.api_key },
    body: JSON.stringify({ number: FONE, text: texto }),
  });
  return instName + (r.ok ? ": enviado" : ": falhou " + r.status + " " + (await r.text()).slice(0, 120));
}
async function zap(sb: any, texto: string) {
  const res: string[] = [];
  for (const nome of INSTANCIAS) {
    try { res.push(await zapUma(sb, nome, texto)); } catch (e) { res.push(nome + ": erro " + String(e).slice(0, 80)); }
  }
  // sem instancia nenhuma: tenta qualquer uma conectada
  if (!res.some((x) => x.endsWith(": enviado"))) {
    const { data } = await sb.from("whatsapp_instances").select(COLS).eq("status", "connected").limit(1).maybeSingle();
    if (data?.instance_name && !INSTANCIAS.includes(data.instance_name)) {
      try { res.push(await zapUma(sb, data.instance_name, texto)); } catch (e) { res.push(data.instance_name + ": erro " + String(e).slice(0, 80)); }
    }
  }
  return (res.some((x) => x.endsWith(": enviado")) ? "enviado" : "falhou") + " [" + res.join(" | ") + "]";
}

// Lê as falhas de transcrição gravadas pelo crm-agent-respond nas últimas 3h. Quebrado =
// pelo menos 2 áudios com falha e nenhum transcrito no período. Avisa no WhatsApp (anti-spam
// de 12h, igual ao check da Anthropic) e manda "voltou" quando normaliza.
function motivoTranscricao(erro: string) {
  const e = erro.toLowerCase();
  if (/incorrect api key|invalid_api_key/.test(e)) return "a chave da OpenAI guardada no Nexus está INVÁLIDA (não é falta de crédito)";
  if (/no credits|insufficient_quota|exceeded your current quota|billing/.test(e)) return "a OpenAI está SEM CRÉDITO";
  if (/assembly.*401|token missing\/invalid/.test(e)) return "a chave da AssemblyAI está inválida";
  if (/balance|insufficient funds/.test(e)) return "a AssemblyAI está sem saldo";
  if (/download \d+/.test(e)) return "o arquivo do áudio não baixou (link vencido)";
  return "erro: " + erro.slice(0, 160);
}
async function vigiaTranscricao(sb: any, silencioso: boolean) {
  const desde = new Date(Date.now() - 3 * 3600000).toISOString();
  const { data: falhas } = await sb.from("crm_whatsapp_messages")
    .select("error_text, created_at").like("error_text", "transcrição falhou:%").gte("created_at", desde)
    .order("created_at", { ascending: false }).limit(50);
  const { count: okCount } = await sb.from("crm_whatsapp_messages")
    .select("id", { count: "exact", head: true }).in("type", ["audio", "ptt"]).eq("direction", "inbound")
    .gte("created_at", desde).not("transcription", "is", null);
  const nFalhas = (falhas || []).length;
  const quebrado = nFalhas >= 2 && !(okCount && okCount > 0);
  const erro = nFalhas ? String(falhas[0].error_text).replace(/^transcrição falhou:\s*/, "") : null;

  const { data: ant } = await sb.from("ai_health_log")
    .select("ok").eq("tipo", "transcricao").order("checked_at", { ascending: false }).limit(1).maybeSingle();
  const estavaQuebrado = ant ? ant.ok === false : false;
  const { data: ult } = await sb.from("ai_health_log")
    .select("checked_at").eq("tipo", "transcricao").eq("alertou", true).order("checked_at", { ascending: false }).limit(1).maybeSingle();
  const horas = ult ? (Date.now() - new Date(ult.checked_at).getTime()) / 3600000 : 1e9;

  let avisou = false, envio = "nao precisou";
  if (quebrado && horas >= ANTI_SPAM_HORAS && !silencioso) {
    const msg = "Nexus — OS AGENTES NÃO ESTÃO OUVINDO OS ÁUDIOS DOS LEADS.\n\n"
      + nFalhas + " áudio(s) sem transcrição nas últimas 3h. Motivo: " + motivoTranscricao(erro || "") + ".\n"
      + "Enquanto isso o agente responde \"não veio o áudio direito, consegue escrever?\" e o lead esfria.\n\n"
      + "Resolve em: platform.openai.com > API keys (criar chave nova, com crédito na conta) e colar em "
      + "Supabase > Edge Functions > Secrets > OPENAI_API_KEY. Reserva: AssemblyAI (ASSEMBLYAI_API_KEY) com saldo.";
    envio = await zap(sb, msg);
    avisou = envio.startsWith("enviado");
  }
  if (!quebrado && estavaQuebrado && !silencioso && okCount && okCount > 0) {
    envio = await zap(sb, "Nexus — a transcrição de áudio voltou. Os agentes já estão ouvindo os áudios dos leads de novo.");
  }
  await sb.from("ai_health_log").insert({ ok: !quebrado, status_code: null, erro: quebrado ? erro : null, alertou: avisou, tipo: "transcricao" });
  return { quebrado, falhas_3h: nFalhas, transcritos_3h: okCount || 0, motivo: quebrado ? motivoTranscricao(erro || "") : null, avisou, envio };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({} as any));

    // { teste_envio: true } manda uma mensagem de teste pelos dois canais e para por aqui
    if (body.teste_envio) {
      const envio = await zap(sb, "Nexus — teste do vigia da IA. Se esta mensagem chegou, o aviso de IA fora do ar chega por aqui.");
      return new Response(JSON.stringify({ ok: true, teste: true, envio }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // 1. chamada minima: 1 token de saida, prompt de um caractere
    let ok = false, status = 0, erro: string | null = null;
    const chave = Deno.env.get("ANTHROPIC_API_KEY");
    if (!chave) { erro = "ANTHROPIC_API_KEY nao configurada no projeto"; }
    else {
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 1, messages: [{ role: "user", content: "." }] }),
        });
        status = r.status;
        if (r.ok) ok = true;
        else {
          const t = await r.text();
          try { erro = JSON.parse(t)?.error?.message ?? t.slice(0, 300); } catch { erro = t.slice(0, 300); }
        }
      } catch (e) { erro = String(e).slice(0, 300); }
    }

    // 1b. transcrição de áudio dos agentes (16/10/2026). Entre 10/10 e 16/10 nenhum áudio de
    // lead foi transcrito (chave da OpenAI inválida e AssemblyAI sem saldo) e o agente passou
    // dias respondendo "não veio o áudio direito" sem ninguém saber. O crm-agent-respond agora
    // grava o motivo em crm_whatsapp_messages.error_text; aqui a gente lê e avisa.
    const transc = await vigiaTranscricao(sb, !!body.silencioso);

    // 2. como estava no check anterior
    const { data: ant } = await sb.from("ai_health_log")
      .select("ok, alertou, checked_at").eq("tipo", "anthropic").order("checked_at", { ascending: false }).limit(1).maybeSingle();
    const estavaQuebrado = ant ? ant.ok === false : false;

    // 3. ja avisei faz pouco?
    const { data: ultAlerta } = await sb.from("ai_health_log")
      .select("checked_at").eq("alertou", true).eq("tipo", "anthropic").order("checked_at", { ascending: false }).limit(1).maybeSingle();
    const horasDesdeAlerta = ultAlerta
      ? (Date.now() - new Date(ultAlerta.checked_at).getTime()) / 3600000 : 1e9;

    let avisou = false, envio = "nao precisou";

    // avisa de novo a cada 12h enquanto estiver fora (rodando a cada 30 min, isso vira um lembrete 2x ao dia)
    if (!ok && horasDesdeAlerta >= ANTI_SPAM_HORAS && !body.silencioso) {
      const semCredito = /credit balance is too low/i.test(erro ?? "");
      const msg = semCredito
        ? "Nexus — A API DA ANTHROPIC ESTA SEM CREDITO.\n\n"
          + "Parou tudo que usa IA: agentes que respondem lead no WhatsApp e Instagram, "
          + "resumo de gestao nos grupos, Cerebro do Cliente, Copiloto, blog, transcricao. "
          + "Sao 90 funcoes e 18 rotinas automaticas.\n\n"
          + "Resolve em: console.anthropic.com > Plans & Billing > Buy credits.\n"
          + "Liga o auto-reload la pra nao repetir."
        : "Nexus — A IA ESTA FORA.\n\n"
          + "Erro: " + (erro ?? "desconhecido").slice(0, 220) + (status ? " (HTTP " + status + ")" : "")
          + "\n\nTudo que depende de IA no sistema esta parado ate resolver.";
      envio = await zap(sb, msg);
      avisou = envio.startsWith("enviado");
    }

    if (ok && estavaQuebrado && !body.silencioso) {
      envio = await zap(sb, "Nexus — a IA voltou a responder. As rotinas automaticas retomam sozinhas no proximo horario.");
    }

    await sb.from("ai_health_log").insert({ ok, status_code: status || null, erro, alertou: avisou, tipo: "anthropic" });

    return new Response(JSON.stringify({ ok, status, erro, avisou, envio, horas_desde_ultimo_alerta: Math.round(horasDesdeAlerta), transcricao: transc }, null, 1),
      { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
