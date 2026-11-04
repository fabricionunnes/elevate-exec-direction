// avisos — Central de Avisos do Fabrício (03/11/2026). Todo aviso pro WhatsApp dele passa por aqui:
//   action "enviar"  {id}            manda na hora um item da fila (chamado por aviso_enviar quando nível = hora)
//   action "resumo"  {lote}          junta tudo que está pendente com nível "resumo" num texto só (cron 8h10 e 20h40)
//   action "ingest"  {tipo, texto, titulo?, origem?, nivel_padrao?}  entrada pra outros projetos (Marcelo), com x-avisos-token
//   action "testar"                   manda uma mensagem de teste pro telefone configurado
// Telefone e instância ficam em avisos_settings; o nível de cada tipo em avisos_config.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INGEST_TOKEN = Deno.env.get("AI_USAGE_TOKEN") || "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-avisos-token" };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const BR = "America/Sao_Paulo";

async function enviarWhatsApp(supabase: any, telefone: string, instanciaPreferida: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  const nomes = [instanciaPreferida, "fabricionunnes", "marceloalmeida"].filter((v, i, a) => v && a.indexOf(v) === i);
  for (const nome of nomes) {
    const { data: inst } = await supabase.from("whatsapp_instances").select("instance_name, api_url, api_key, provider_type").eq("instance_name", nome).eq("status", "connected").maybeSingle();
    if (!inst?.api_url || !inst?.api_key) continue;
    const base = String(inst.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
    const v2 = inst.provider_type === "manager_v2" || base.includes("stevo");
    try {
      const r = await fetch(v2 ? `${base}/send/text` : `${base}/message/sendText/${inst.instance_name}`, {
        method: "POST", headers: { apikey: String(inst.api_key), "Content-Type": "application/json" },
        body: JSON.stringify({ number: telefone, text: texto }),
      });
      if (r.ok) return { ok: true };
    } catch (e) { console.error("[avisos] envio falhou", nome, e); }
  }
  return { ok: false, erro: "nenhuma instância conectada conseguiu enviar" };
}

// quebra um texto longo em mensagens de até ~3500 caracteres, nos limites de parágrafo
function partes(texto: string, max = 3500): string[] {
  if (texto.length <= max) return [texto];
  const out: string[] = []; let atual = "";
  for (const bloco of texto.split("\n\n")) {
    if ((atual + "\n\n" + bloco).length > max && atual) { out.push(atual); atual = bloco; }
    else atual = atual ? `${atual}\n\n${bloco}` : bloco;
  }
  if (atual) out.push(atual);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const action = String(body.action || new URL(req.url).searchParams.get("action") || "");
  const { data: st } = await supabase.from("avisos_settings").select("*").eq("id", true).maybeSingle();
  const telefone = String(st?.telefone || "5531989840003").replace(/\D/g, "");
  const instancia = String(st?.instancia || "fabricionunnes");

  if (action === "ingest") {
    const tok = req.headers.get("x-avisos-token") || "";
    if (!INGEST_TOKEN || tok !== INGEST_TOKEN) return j({ ok: false, error: "token inválido" }, 401);
    const tipo = String(body.tipo || "").trim(); const texto = String(body.texto || "").trim();
    if (!tipo || !texto) return j({ ok: false, error: "tipo e texto obrigatórios" }, 400);
    const { data, error } = await supabase.rpc("aviso_enviar", { p_tipo: tipo, p_texto: texto, p_titulo: body.titulo || null, p_origem: body.origem || "marcelo", p_nivel_padrao: body.nivel_padrao || "resumo" });
    if (error) return j({ ok: false, error: error.message }, 500);
    return j({ ok: true, id: data });
  }

  if (action === "enviar") {
    const id = String(body.id || "");
    const { data: item } = await supabase.from("avisos_fila").select("id, tipo, texto, enviado_em").eq("id", id).maybeSingle();
    if (!item) return j({ ok: false, error: "item não encontrado" }, 404);
    if (item.enviado_em) return j({ ok: true, ja_enviado: true });
    const r = await enviarWhatsApp(supabase, telefone, instancia, item.texto);
    await supabase.from("avisos_fila").update({ enviado_em: r.ok ? new Date().toISOString() : null, lote: r.ok ? "hora" : null, erro: r.ok ? null : r.erro }).eq("id", id);
    return j({ ok: r.ok, erro: r.erro });
  }

  if (action === "resumo") {
    const lote = body.lote === "noite" ? "noite" : "manha";
    const { data: pend } = await supabase.from("avisos_fila").select("id, tipo, texto, created_at").is("enviado_em", null).eq("nivel", "resumo").order("created_at").limit(300);
    const itens = pend || [];
    if (!itens.length) return j({ ok: true, lote, itens: 0, aviso: "nada pendente" });
    const { data: cfgs } = await supabase.from("avisos_config").select("tipo, titulo");
    const titulo = new Map((cfgs || []).map((c: any) => [c.tipo, c.titulo]));
    const grupos = new Map<string, string[]>();
    for (const it of itens) { const k = it.tipo; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k)!.push(String(it.texto).trim()); }
    const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: BR, day: "2-digit", month: "2-digit" });
    const hora = new Date().toLocaleTimeString("pt-BR", { timeZone: BR, hour: "2-digit", minute: "2-digit" });
    const blocos: string[] = [`*Resumo da ${lote === "noite" ? "noite" : "manhã"} · ${hoje} ${hora}*\n${itens.length} aviso${itens.length === 1 ? "" : "s"} em ${grupos.size} assunto${grupos.size === 1 ? "" : "s"}`];
    for (const [tipo, textos] of grupos) {
      const cab = `▸ *${titulo.get(tipo) || tipo}*${textos.length > 1 ? ` (${textos.length})` : ""}`;
      // tira a repetição exata (mesmo aviso disparado várias vezes no período)
      const unicos = [...new Set(textos)];
      blocos.push([cab, ...unicos.map((t) => t.replace(/^\*[^*\n]+\*\n+/, ""))].join("\n"));
    }
    const msgs = partes(blocos.join("\n\n"));
    let okTodas = true; let erro: string | undefined;
    for (const m of msgs) { const r = await enviarWhatsApp(supabase, telefone, instancia, m); if (!r.ok) { okTodas = false; erro = r.erro; break; } }
    if (okTodas) await supabase.from("avisos_fila").update({ enviado_em: new Date().toISOString(), lote }).in("id", itens.map((i: any) => i.id));
    else await supabase.from("avisos_fila").update({ erro }).in("id", itens.map((i: any) => i.id));
    return j({ ok: okTodas, lote, itens: itens.length, assuntos: grupos.size, mensagens: msgs.length, erro });
  }

  if (action === "testar") {
    if (!req.headers.get("authorization")) return j({ ok: false, error: "não autenticado" }, 401);
    const r = await enviarWhatsApp(supabase, telefone, instancia, "Teste da Central de Avisos do Nexus. Se chegou, está tudo certo.");
    return j(r);
  }

  return j({ ok: false, error: "action inválida (enviar, resumo, ingest, testar)" }, 400);
});
