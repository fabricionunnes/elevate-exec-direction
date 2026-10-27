// ai-team-chat: conversa com o Max, coordenador do Time de IA da empresa.
// O Max responde com os mesmos dados reais que o orquestrador lê (buildContext) e tem
// ferramentas pra agir: rodar um agente, aprovar/rejeitar item da fila, ligar/desligar
// ou reconfigurar um agente. Histórico em ai_team_messages (uma thread por empresa).
//
// body: {companyId, message}            -> responde e grava user + assistant
//       {companyId, message, reset:true} -> apaga a thread antes de responder
// Exige JWT com acesso à empresa (ai_team_has_access) ou service role.
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  corsHeaders, SUPABASE_URL, SERVICE_KEY, MODEL, type Agent, type Company, type Ctx,
  json, jwtRole, logUsoIA, buildContext, dadosBlock, brNow,
} from "./shared.ts";

// contexto de dados vale por 5 min dentro do isolate: a conversa por voz não pode
// esperar as consultas a cada frase (o orquestrador continua pedindo fresco)
const CTX_CACHE_MS = 5 * 60 * 1000;

const CHAT_MODEL = Deno.env.get("AI_TEAM_CHAT_MODEL") || MODEL;
const MAX_TOOL_ROUNDS = 6;

const TOOLS = [
  {
    name: "rodar_agente",
    description: "Coloca um agente do time pra trabalhar agora. Use quando o dono pedir pra rodar/acionar alguém ou quando a pergunta dele exige uma entrega nova (anúncios, posts, mensagens, análise de tráfego, briefing). Demora de 5 a 60 segundos.",
    input_schema: {
      type: "object",
      properties: { agent_key: { type: "string", enum: ["briefing", "anuncios", "conteudo", "reativacao", "trafego", "qualificacao"] } },
      required: ["agent_key"],
    },
  },
  {
    name: "ver_negociacoes",
    description: "Lista as negociações abertas do CRM com valor, etapa, dono, dias sem contato e próxima atividade (até 40, da maior pra menor). Use quando o dono falar em meta, bater número, fechar venda, 'preciso vender X', ou perguntar o que tem pra fechar.",
    input_schema: { type: "object", properties: { minimo: { type: "number", description: "filtra por valor mínimo em reais (opcional)" } } },
  },
  {
    name: "ver_fila",
    description: "Lê os itens pendentes de aprovação com o conteúdo completo (texto do anúncio, legenda do post, mensagem). Use antes de opinar sobre um item ou quando o dono perguntar o que tem na fila.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "decidir_item",
    description: "Aprova ou rejeita um item da fila em nome do dono. Só use quando o dono mandar explicitamente (ex: 'aprova o anúncio 2', 'joga fora os posts').",
    input_schema: {
      type: "object",
      properties: {
        approval_id: { type: "string" },
        decisao: { type: "string", enum: ["approved", "rejected"] },
        nota: { type: "string" },
      },
      required: ["approval_id", "decisao"],
    },
  },
  {
    name: "atualizar_agente",
    description: "Liga/desliga um agente, muda o horário dele ou ajusta oferta/público/tom usados nos anúncios, posts e mensagens. Só quando o dono pedir.",
    input_schema: {
      type: "object",
      properties: {
        agent_key: { type: "string", enum: ["atendimento", "briefing", "anuncios", "conteudo", "reativacao", "trafego", "qualificacao"] },
        is_active: { type: "boolean" },
        schedule: { type: "object", properties: { hour: { type: "string" }, days: { type: "array", items: { type: "integer" } } } },
        oferta: { type: "string" }, publico: { type: "string" }, tom: { type: "string" },
      },
      required: ["agent_key"],
    },
  },
];

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const agendaLabel = (s: Agent["schedule"]) => !s?.hour ? "por canal / sob demanda" : `${(s.days?.length || 0) >= 6 ? "seg a sáb" : (s.days || []).map((d) => DOW[d]).join(", ")} às ${s.hour}`;
const timeAgo = (iso?: string | null) => {
  if (!iso) return "nunca rodou";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)}h` : `há ${Math.round(m / 1440)}d`;
};

async function loadTeamState(supabase: SupabaseClient, companyId: string) {
  const [agentsR, filaR, runsR] = await Promise.all([
    supabase.from("ai_team_agents").select("*").eq("company_id", companyId),
    supabase.from("ai_team_approvals").select("id, agent_key, kind, title, payload, created_at").eq("company_id", companyId).eq("status", "pending").order("created_at", { ascending: false }).limit(30),
    supabase.from("ai_team_runs").select("agent_key, status, summary, finished_at, started_at").eq("company_id", companyId).order("started_at", { ascending: false }).limit(12),
  ]);
  return { agents: (agentsR.data || []) as Agent[], fila: (filaR.data || []) as any[], runs: (runsR.data || []) as any[] };
}

async function runTool(supabase: SupabaseClient, c: Company, name: string, input: any, userId: string | null, ctx: Ctx): Promise<any> {
  if (name === "ver_negociacoes") {
    const min = Number(input?.minimo || 0);
    return ctx.negociacoes.filter((n) => n.valor >= min).map((n) => ({
      lead_id: n.id, nome: n.name, valor: n.valor, funil: n.pipeline, etapa: n.stage,
      dias_sem_contato: n.dias === 999 ? null : n.dias, dono: n.dono, proxima_atividade: n.proximaAtividade,
    }));
  }
  if (name === "ver_fila") {
    const { fila } = await loadTeamState(supabase, c.id);
    return fila.map((f) => ({ id: f.id, agente: f.agent_key, tipo: f.kind, titulo: f.title, conteudo: f.payload }));
  }
  if (name === "decidir_item") {
    const { data, error } = await supabase.from("ai_team_approvals")
      .update({ status: input.decisao, note: input.nota || "decidido pelo Max no chat", decided_at: new Date().toISOString(), decided_by: userId })
      .eq("id", input.approval_id).eq("company_id", c.id).eq("status", "pending").select("id, title").maybeSingle();
    if (error) return { erro: error.message };
    if (!data) return { erro: "item não encontrado ou já decidido" };
    return { ok: true, item: data.title, status: input.decisao };
  }
  if (name === "atualizar_agente") {
    const { data: ag } = await supabase.from("ai_team_agents").select("id, config, schedule").eq("company_id", c.id).eq("agent_key", input.agent_key).maybeSingle();
    if (!ag) return { erro: "agente não encontrado" };
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof input.is_active === "boolean") patch.is_active = input.is_active;
    if (input.schedule?.hour) patch.schedule = { hour: input.schedule.hour, days: input.schedule.days || ag.schedule?.days || [1, 2, 3, 4, 5] };
    const cfg = { ...(ag.config || {}) };
    for (const k of ["oferta", "publico", "tom"]) if (typeof input[k] === "string") cfg[k] = input[k];
    patch.config = cfg;
    const { error } = await supabase.from("ai_team_agents").update(patch).eq("id", ag.id);
    return error ? { erro: error.message } : { ok: true, agent_key: input.agent_key, alterado: Object.keys(patch).filter((k) => k !== "updated_at") };
  }
  if (name === "rodar_agente") {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-team-orchestrator`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      body: JSON.stringify({ companyId: c.id, agentKey: input.agent_key }),
    });
    const data = await resp.json().catch(() => ({}));
    const r = data?.results?.[0];
    if (!resp.ok || !r) return { erro: data?.error || `orquestrador respondeu ${resp.status}` };
    if (r.error) return { erro: r.error };
    const ran = (r.ran || [])[0];
    return { ok: true, agente: ran?.name || input.agent_key, status: ran?.status, entrega: ran?.summary, novos_itens_na_fila: r.novasAprovacoes || 0 };
  }
  return { erro: `ferramenta desconhecida: ${name}` };
}

function systemPrompt(c: Company, agents: Agent[], fila: any[], runs: any[], dados: string, donoNome: string | null): string {
  const max = agents.find((a) => a.agent_key === "orquestrador");
  const time = agents.filter((a) => a.agent_key !== "orquestrador").map((a) =>
    `- ${a.name} (${a.role_title}, chave ${a.agent_key}): ${a.is_active ? "ligado" : "DESLIGADO"}, agenda ${agendaLabel(a.schedule)}, última rodada ${timeAgo(a.last_run_at)}`).join("\n");
  const filaTxt = fila.length
    ? fila.map((f) => `- [${f.id}] ${f.kind} de ${agents.find((a) => a.agent_key === f.agent_key)?.name || f.agent_key}: "${f.title}"`).join("\n")
    : "vazia";
  const rodadas = runs.slice(0, 8).map((r) => `- ${agents.find((a) => a.agent_key === r.agent_key)?.name || r.agent_key} (${timeAgo(r.finished_at || r.started_at)}, ${r.status}): ${String(r.summary || "").slice(0, 350)}`).join("\n") || "nenhuma ainda";
  const agora = brNow();
  return `Você é ${max?.name || "Max"}, coordenador do Time de IA da ${c.name}. Você conversa com o dono da empresa${donoNome ? ` (${donoNome})` : ""} como um sócio operador: direto, humano, sem enrolação, sem emoji, sem markdown (nada de #, **, listas com asterisco; se precisar enumerar, use linhas simples com hífen ou números). Português do Brasil. Frases curtas. Você entende de vendas, gestão comercial, marketing e caixa.

Hoje é ${DOW[agora.getDay()]}, ${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (Brasília).

SEU TIME:
${time}

FILA DE APROVAÇÃO (itens que o dono ainda não decidiu):
${filaTxt}

ÚLTIMAS RODADAS:
${rodadas}

DADOS DA EMPRESA (lidos agora do Nexus):
${dados || "nenhum dado além da oferta"}

Como agir:
- Responda com número quando tiver número. Nunca invente dado; se não está acima, diga que não tem e o que faltaria lançar.
- Quando o dono pedir pra alguém do time fazer algo, use rodar_agente e depois conte o que saiu (resuma a entrega, não copie inteira).
- Quando o dono pedir pra aprovar/rejeitar, use ver_fila se precisar achar o item certo e depois decidir_item. Confirme o que fez em uma linha.
- Quando ele perguntar "o que eu faço", opine: escolha, priorize, discorde se for o caso. Você tem opinião.
- Quando ele colocar uma META ("preciso vender 40 mil hoje", "tenho que fechar 3 contratos essa semana"), NÃO responda com teoria: vá nas negociações abertas (estão nos dados; use ver_negociacoes se precisar da lista completa), some quais fecham a meta, diga NOME, VALOR e ETAPA de cada uma, quem está cuidando, e o que fazer AGORA com cada uma (ligar, mandar proposta, cobrar resposta). Ofereça deixar as mensagens prontas pelo Theo ou pelo time.
- Primeiro responda exatamente o que foi perguntado; só depois, se couber, acrescente o que você acha.
- Se ele pedir algo que o time não faz (ligar pra cliente, publicar anúncio na Meta, mandar WhatsApp), diga com clareza que isso ainda é mão humana e deixe pronto o que der (texto, lista, prioridade).
- Respostas de 2 a 8 linhas. Só alongue quando ele pedir detalhe.`;
}

// Em voz alta a conversa precisa caber no ouvido: curto, redondo, sem lista.
const MODO_VOZ = `

MODO VOZ: o dono está falando com você por áudio e vai OUVIR sua resposta. A transcrição pode vir com erro de reconhecimento: interprete pelo contexto ("vender quarenta mil" = meta de R$ 40 mil) e, se ficar em dúvida real, pergunte em uma frase curta. Responda em 1 a 5 frases faladas, como numa ligação: sem lista, sem hífen, sem número com centavos (arredonde: "quarenta e dois mil"), sem sigla sem explicar, sem URL. A primeira frase já tem que ser a resposta, nunca um preâmbulo. Se tiver muita coisa, dê as 2 ou 3 mais importantes e pergunte se ele quer o resto. Quando acionar alguém do time, avise antes em uma frase ("vou pedir pro Theo escrever, me dá uns segundos") e depois conte o resultado em uma ou duas frases.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const role = jwtRole(token);
    if (!body.companyId || !String(body.message || "").trim()) return json({ error: "companyId e message são obrigatórios" }, 400);
    const message = String(body.message).trim().slice(0, 4000);

    let userId: string | null = null;
    let donoNome: string | null = null;
    if (role !== "service_role") {
      const asUser = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await asUser.auth.getUser(token);
      if (!user) return json({ error: "não autenticado" }, 401);
      const { data: ok } = await asUser.rpc("ai_team_has_access", { p_company_id: body.companyId });
      if (!ok) return json({ error: "sem acesso à empresa" }, 403);
      userId = user.id;
      donoNome = (user.user_metadata?.full_name || user.user_metadata?.name || null) as string | null;
    }

    const { data: c } = await supabase.from("onboarding_companies").select("id, name, segment, phone").eq("id", body.companyId).maybeSingle();
    if (!c) return json({ error: "empresa não encontrada" }, 404);
    if (body.reset === true) await supabase.from("ai_team_messages").delete().eq("company_id", c.id);

    const { agents, fila, runs } = await loadTeamState(supabase, c.id);
    if (!agents.length) return json({ error: "time não montado" }, 400);
    const ctx = await buildContext(supabase, c as Company, agents, { cacheMs: CTX_CACHE_MS });
    const dados = ctx.modo === "nexus_unv" ? dadosBlock(ctx, ["financeiro", "comercial", "carteira", "trafego", "catalogo"]) : (ctx.kpis ? dadosBlock(ctx, ["kpis"]) : "") ;
    const system = systemPrompt(c as Company, agents, fila, runs, `${ctx.oferta}\n\n${dados}`, donoNome) + (body.modo === "voz" ? MODO_VOZ : "");

    // histórico (últimas 30 mensagens, ordem cronológica)
    const { data: hist } = await supabase.from("ai_team_messages").select("role, content").eq("company_id", c.id).order("created_at", { ascending: false }).limit(30);
    const messages: any[] = ((hist || []) as any[]).reverse().map((m) => ({ role: m.role, content: m.content }));
    messages.push({ role: "user", content: message });
    await supabase.from("ai_team_messages").insert({ company_id: c.id, user_id: userId, role: "user", content: message });

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);
    const actions: any[] = [];
    let reply = "";
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: CHAT_MODEL, max_tokens: 1200, temperature: 0.7, system, tools: TOOLS, messages }),
      });
      if (!resp.ok) throw new Error(`Claude ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
      const data = await resp.json();
      logUsoIA("ai-team-chat", CHAT_MODEL, data?.usage, { company: c.id, round });
      const content = data.content || [];
      const toolUses = content.filter((b: any) => b.type === "tool_use");
      const text = content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
      if (!toolUses.length || round === MAX_TOOL_ROUNDS) { reply = text || reply || "Feito."; break; }
      messages.push({ role: "assistant", content });
      const results: any[] = [];
      for (const tu of toolUses) {
        const result = await runTool(supabase, c as Company, tu.name, tu.input || {}, userId, ctx);
        actions.push({ tool: tu.name, input: tu.input, result });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result).slice(0, 12000) });
      }
      messages.push({ role: "user", content: results });
    }

    await supabase.from("ai_team_messages").insert({ company_id: c.id, user_id: userId, role: "assistant", content: reply, meta: actions.length ? { actions } : null });
    return json({ ok: true, reply, actions });
  } catch (e) {
    console.error("ai-team-chat", e);
    return json({ error: (e as Error).message }, 500);
  }
});
