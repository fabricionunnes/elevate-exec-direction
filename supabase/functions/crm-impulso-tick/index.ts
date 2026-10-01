// Motor dos Impulsos do CRM (execução em massa por lotes, 30/09/2026).
// pg_cron chama a cada minuto com o header x-impulso-secret (secret IMPULSO_SECRET, o
// mesmo valor de app_secrets.impulso_secret). Cada chamada processa NO MÁXIMO UM LOTE por
// impulso vencido (crm_impulso_claim reserva os itens e já confere janela de horário e
// teto diário do número) e termina. Nada de loop longo: o ritmo é do banco
// (next_batch_at), não desta função.
//
// O que cada ação faz com o lote:
//   whatsapp_text      envia um por um pelo número conectado (Evolution), grava no
//                      Atendimento e marca o item (enviado ou falhou com o motivo)
//   official_template  o claim já pôs o lote como destinatário do disparo oficial; aqui só
//                      chama a edge official-campaign-dispatch, que envia e registra tudo.
//                      O item acompanha o destinatário (crm_impulso_sync_official)
//   move_stage, add_tag, assign_owner, cadence   só banco: crm_impulso_apply_db
//
// Corpo opcional: { dry_run: true } mostra o lote que sairia, sem enviar nem reservar;
// { impulso_id } força um impulso específico; { background: true } responde na hora e
// processa em segundo plano (é o que o cron usa).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-impulso-secret" };
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const digits = (p: string | null | undefined) => String(p || "").replace(/\D/g, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BUDGET_MS = 100_000;      // tempo total de uma execução
const MAX_IMPULSOS = 8;         // impulsos atendidos por execução (um lote de cada)
const PAUSA_ENTRE_ENVIOS = 700; // texto: respiro entre uma mensagem e outra
const BUCKET = "crm-execucoes";

function isManagerV2Url(input?: string | null) {
  try { return new URL(String(input || "").replace(/\/+$/g, "")).hostname.toLowerCase().endsWith(".stevo.chat"); } catch { return false; }
}
const normalizeBaseUrl = (u: string) => String(u || "").replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");

type Inst = { id: string; instance_name: string; api_url: string | null; api_key: string | null; provider_type: string | null; status: string | null };

// Mesmo envio do evolution-api action=sendText (o que o chat e as mensagens agendadas usam).
async function sendEvolution(inst: Inst, phone: string, message: string): Promise<{ ok: boolean; error?: string; remoteId?: string | null }> {
  const apiUrl = inst.api_url || Deno.env.get("EVOLUTION_API_URL");
  const apiKey = inst.api_key || Deno.env.get("EVOLUTION_API_KEY");
  if (!apiUrl || !apiKey) return { ok: false, error: `Número ${inst.instance_name} sem api_url/api_key` };
  const base = normalizeBaseUrl(apiUrl);
  const v2 = inst.provider_type === "manager_v2" || isManagerV2Url(base);
  const number = digits(phone);
  let r: Response;
  try {
    r = await fetch(v2 ? `${base}/send/text` : `${base}/message/sendText/${inst.instance_name}`, {
      method: "POST",
      headers: v2
        ? { "Content-Type": "application/json", apikey: apiKey }
        : { "Content-Type": "application/json", apikey: apiKey, Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey },
      body: JSON.stringify(v2 ? { number, text: message, delay: 0 } : { number, text: message }),
    });
  } catch (e) {
    return { ok: false, error: `Servidor do WhatsApp fora do ar: ${String(e).slice(0, 120)}` };
  }
  const text = await r.text();
  let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  const dataStr = JSON.stringify(data || {});
  if (!r.ok) {
    if (dataStr.toLowerCase().includes("connection closed")) return { ok: false, error: "Número desconectado no servidor do WhatsApp" };
    if (dataStr.includes('"exists":false') || dataStr.includes('"exists": false')) return { ok: false, error: "Este número não possui WhatsApp" };
    const msg = data?.message || data?.error || data?.response?.message || `HTTP ${r.status}: ${text.slice(0, 120)}`;
    return { ok: false, error: typeof msg === "string" ? msg : JSON.stringify(msg).slice(0, 200) };
  }
  const remoteId = data?.key?.id || data?.data?.key?.id || data?.messageId || data?.id || null;
  return { ok: true, remoteId: remoteId ? String(remoteId) : null };
}

// "RENATA SOUZA" vira "Renata"
const firstName = (name: string | null | undefined) => {
  const f = String(name || "").trim().split(/\s+/)[0] || "";
  if (!f) return "";
  return f === f.toUpperCase() ? f.charAt(0) + f.slice(1).toLowerCase() : f;
};
/** {{nome}}, {{primeiro_nome}}, {{empresa}}. Variável sem valor some (não manda "{{empresa}}" pro cliente). */
function render(tpl: string, v: Record<string, string>) {
  return String(tpl || "")
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => (k in v ? v[k] : ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?])/g, "$1")
    .trim();
}

/** contato + conversa + mensagem no Atendimento (mesmo formato da cadência e do evolution-webhook). */
async function registrarNoAtendimento(a: {
  instanceId: string; leadId: string | null; name: string; phone: string; content: string; remoteId: string | null; staffId: string | null;
}): Promise<{ conversationId: string | null; messageId: string | null }> {
  const phone = digits(a.phone);
  let { data: contact } = await supabase.from("crm_whatsapp_contacts").select("id, lead_id").eq("phone", phone).maybeSingle();
  if (!contact) {
    const { data: created, error } = await supabase.from("crm_whatsapp_contacts")
      .insert({ phone, name: a.name || phone, lead_id: a.leadId }).select("id, lead_id").single();
    if (error) throw error;
    contact = created;
  } else if (!contact.lead_id && a.leadId) {
    await supabase.from("crm_whatsapp_contacts").update({ lead_id: a.leadId }).eq("id", contact.id);
  }
  let { data: conv } = await supabase.from("crm_whatsapp_conversations").select("id, lead_id")
    .eq("instance_id", a.instanceId).eq("contact_id", contact!.id).neq("status", "closed").is("merged_into", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!conv) {
    const { data: created, error } = await supabase.from("crm_whatsapp_conversations")
      .insert({ instance_id: a.instanceId, contact_id: contact!.id, lead_id: a.leadId, status: "open" })
      .select("id, lead_id").single();
    if (error) throw error;
    conv = created;
  } else if (!conv.lead_id && a.leadId) {
    await supabase.from("crm_whatsapp_conversations").update({ lead_id: a.leadId }).eq("id", conv.id);
  }
  const now = new Date().toISOString();
  const { data: msg } = await supabase.from("crm_whatsapp_messages").insert({
    conversation_id: conv!.id, content: a.content, type: "text", direction: "outbound", status: "sent",
    remote_id: a.remoteId, whatsapp_message_id: a.remoteId, is_ai: false, sent_by: a.staffId,
  }).select("id").maybeSingle();
  await supabase.from("crm_whatsapp_conversations")
    .update({ last_message: a.content.substring(0, 255), last_message_at: now }).eq("id", conv!.id);
  return { conversationId: conv!.id, messageId: msg?.id || null };
}

async function loteTexto(imp: any, items: any[], inicio: number) {
  const out = { enviados: 0, falhas: 0, devolvidos: 0 };
  const { data: inst } = await supabase.from("whatsapp_instances")
    .select("id, instance_name, api_url, api_key, provider_type, status").eq("id", imp.config?.instance_id).maybeSingle();
  // número fora do ar: devolve o lote e pausa, em vez de queimar a lista inteira com falha
  if (!inst || inst.status !== "connected") {
    await supabase.from("crm_impulso_items").update({ status: "pending", claimed_at: null, batch_no: null, sender_id: null })
      .in("id", items.map((i) => i.id)).eq("status", "sending");
    await supabase.from("crm_impulsos").update({
      status: "paused", updated_at: new Date().toISOString(),
      pause_reason: inst ? `O número ${inst.instance_name} está desconectado. Reconecte e clique em Retomar.` : "O número escolhido não existe mais.",
    }).eq("id", imp.id).eq("status", "running");
    out.devolvidos = items.length;
    return out;
  }
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    // sem tempo pra terminar o lote: o resto volta pra fila e sai no próximo
    if (Date.now() - inicio > BUDGET_MS - 8000) {
      const resto = items.slice(k).map((x) => x.id);
      await supabase.from("crm_impulso_items").update({ status: "pending", claimed_at: null, batch_no: null, sender_id: null })
        .in("id", resto).eq("status", "sending");
      out.devolvidos += resto.length;
      break;
    }
    const nome = String(it.name || "").trim();
    const message = render(imp.config?.message || "", { nome, primeiro_nome: firstName(nome), empresa: String(it.company || "").trim() });
    try {
      if (!message) throw new Error("Mensagem vazia depois de preencher as variáveis");
      const sent = await sendEvolution(inst as Inst, it.phone, message);
      if (!sent.ok) throw new Error(sent.error || "Falha no envio");
      let reg: { conversationId: string | null; messageId: string | null } = { conversationId: null, messageId: null };
      try {
        reg = await registrarNoAtendimento({ instanceId: inst.id, leadId: it.lead_id, name: nome, phone: it.phone, content: message, remoteId: sent.remoteId || null, staffId: imp.created_by });
      } catch (e) {
        console.error("[crm-impulso-tick] registrar no atendimento", it.id, e);
      }
      const agora = new Date().toISOString();
      await supabase.from("crm_impulso_items").update({
        status: "sent", error: null, sent_at: agora, done_at: agora, message_id: reg.messageId, conversation_id: reg.conversationId,
      }).eq("id", it.id);
      out.enviados++;
    } catch (e) {
      await supabase.from("crm_impulso_items").update({
        status: "failed", error: String((e as Error)?.message || e).slice(0, 400), done_at: new Date().toISOString(),
      }).eq("id", it.id);
      out.falhas++;
    }
    if (k < items.length - 1) await sleep(PAUSA_ENTRE_ENVIOS);
  }
  return out;
}

async function chamarDisparoOficial(campaignId: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/official-campaign-dispatch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ campaign_id: campaignId }),
  });
  if (!r.ok) throw new Error(`official-campaign-dispatch HTTP ${r.status}`);
}

// Impulso terminou com falha ou item pulado: a lista vai em CSV pra Central de Execuções.
async function gravarCsvDeErros(imp: any) {
  if (!imp.execution_id || !imp.created_by) return;
  const linhas: any[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data } = await supabase.from("crm_impulso_items").select("name, phone, company, status, error, batch_no")
      .eq("impulso_id", imp.id).in("status", ["failed", "skipped", "cancelled"]).order("created_at").range(from, from + 999);
    linhas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  if (!linhas.length) return;
  const rot: Record<string, string> = { failed: "Falhou", skipped: "Pulado", cancelled: "Cancelado" };
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const csv = [["Nome", "Telefone", "Empresa", "Status", "Motivo", "Lote"].map(esc).join(";"),
    ...linhas.map((l) => [l.name, l.phone, l.company, rot[l.status] || l.status, l.error, l.batch_no].map(esc).join(";"))].join("\r\n");
  const path = `${imp.created_by}/${imp.execution_id}/erros-impulso.csv`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), { upsert: true, contentType: "text/csv;charset=utf-8" });
  if (error) { console.error("[crm-impulso-tick] csv de erros", imp.id, error.message); return; }
  await supabase.from("crm_executions").update({ errors_path: path, updated_at: new Date().toISOString() }).eq("id", imp.execution_id);
}

async function fecharSeTerminou(imp: any) {
  const { data: status } = await supabase.rpc("crm_impulso_recontar", { p_id: imp.id });
  if (status === "done") await gravarCsvDeErros(imp);
  return status as string | null;
}

async function rodar(opts: { dry: boolean; impulsoId: string | null }) {
  const inicio = Date.now();
  const out: any[] = [];
  const vistos = new Set<string>();
  for (let n = 0; n < MAX_IMPULSOS && Date.now() - inicio < BUDGET_MS - 15_000; n++) {
    const { data: claim, error } = await supabase.rpc("crm_impulso_claim", { p_impulso: opts.impulsoId, p_dry: opts.dry });
    if (error) { out.push({ error: error.message }); break; }
    if (!claim || claim.none) break;

    // sem lote: fora da janela, teto atingido, aguardando retorno, pausado...
    if (!claim.impulso) {
      const res: any = { impulso_id: claim.impulso_id, info: claim.info, proximo: claim.proximo };
      if (claim.dispatch && claim.campaign_id) {
        try { await chamarDisparoOficial(claim.campaign_id); res.dispatch = true; } catch (e) { res.dispatch_error = String((e as Error).message); }
      }
      if (claim.status === "done") {
        const { data: imp } = await supabase.from("crm_impulsos").select("id, execution_id, created_by").eq("id", claim.impulso_id).maybeSingle();
        if (imp) await gravarCsvDeErros(imp);
      }
      out.push(res);
      if (opts.impulsoId || vistos.has(claim.impulso_id)) break;
      vistos.add(claim.impulso_id);
      continue;
    }

    const imp = claim.impulso;
    const items: any[] = claim.items || [];
    const res: any = { impulso_id: imp.id, name: imp.name, action: imp.action, lote: imp.batches, itens: items.length };

    if (opts.dry) {
      res.dry_run = true;
      res.usados_hoje = claim.usados_hoje;
      res.preview = items.map((it) => ({
        item_id: it.id, lead_id: it.lead_id, name: it.name, phone: it.phone,
        would: imp.action === "whatsapp_text"
          ? render(imp.config?.message || "", { nome: String(it.name || "").trim(), primeiro_nome: firstName(it.name), empresa: String(it.company || "").trim() })
          : imp.action,
      }));
      out.push(res);
      break; // simulação mostra um impulso só (nada muda no banco, repetir traria o mesmo)
    }

    try {
      if (imp.action === "whatsapp_text") {
        Object.assign(res, await loteTexto(imp, items, inicio));
      } else if (imp.action === "official_template") {
        if (claim.campaign_id) { await chamarDisparoOficial(claim.campaign_id); res.dispatch = true; }
      } else {
        const { data: r, error: e2 } = await supabase.rpc("crm_impulso_apply_db", { p_id: imp.id });
        if (e2) throw new Error(e2.message);
        Object.assign(res, r || {});
      }
    } catch (e) {
      res.error = String((e as Error)?.message || e).slice(0, 300);
      console.error("[crm-impulso-tick]", imp.id, e);
    }
    res.status = await fecharSeTerminou(imp);
    out.push(res);
    if (opts.impulsoId) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("IMPULSO_SECRET");
  if (!secret || req.headers.get("x-impulso-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const opts = { dry: !!body?.dry_run, impulsoId: typeof body?.impulso_id === "string" ? body.impulso_id : null };

  if (body?.background && !opts.dry) {
    // @ts-ignore EdgeRuntime existe no runtime do Supabase
    EdgeRuntime.waitUntil(rodar(opts).then((r) => { if (r.length) console.log("[crm-impulso-tick]", JSON.stringify(r)); }).catch((e) => console.error("[crm-impulso-tick]", e)));
    return json({ ok: true, started: true });
  }
  const results = await rodar(opts);
  return json({ ok: true, dry_run: opts.dry, processed: results.length, results });
});
