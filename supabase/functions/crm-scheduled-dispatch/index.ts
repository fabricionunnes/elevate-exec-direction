// Mensagens agendadas do Atendimento (crm_scheduled_messages), 30/09/2026.
// pg_cron chama a cada minuto com o header x-scheduler-secret (secret SCHEDULED_SECRET).
// Pega as pendentes vencidas, manda pelo MESMO caminho que o botão Enviar do chat usa
// (Evolution: /message/sendText ou /send/text do Manager V2; API oficial: Graph /messages),
// grava a mensagem na conversa como uma enviada normal (o trigger da tabela sobe a
// conversa e atualiza a última mensagem) e marca sent/failed com o erro.
// Corpo opcional: { dry_run: true } só lista o que iria sair; { id } processa uma só.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scheduler-secret" };
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const digits = (p: string | null | undefined) => String(p || "").replace(/\D/g, "");
const LOTE = 40;

function isManagerV2Url(input?: string | null) {
  try { return new URL(String(input || "").replace(/\/+$/g, "")).hostname.toLowerCase().endsWith(".stevo.chat"); } catch { return false; }
}
const normalizeBaseUrl = (u: string) => String(u || "").replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");

// Mesmo envio do evolution-api action=sendText (o chat chama essa action).
async function sendEvolution(instanceId: string, phone: string, message: string) {
  const { data: inst } = await supabase.from("whatsapp_instances")
    .select("id, instance_name, api_url, api_key, provider_type, status").eq("id", instanceId).maybeSingle();
  if (!inst) return { ok: false, error: "Número (instância) não encontrado" };
  const apiUrl = inst.api_url || Deno.env.get("EVOLUTION_API_URL");
  const apiKey = inst.api_key || Deno.env.get("EVOLUTION_API_KEY");
  if (!apiUrl || !apiKey) return { ok: false, error: `Número ${inst.instance_name} sem api_url/api_key` };
  if (inst.status !== "connected") return { ok: false, error: `Número ${inst.instance_name} desconectado` };
  const base = normalizeBaseUrl(apiUrl);
  const v2 = inst.provider_type === "manager_v2" || isManagerV2Url(base);
  const d = digits(phone);
  const isGroup = d.startsWith("120363") && d.length > 15;
  const number = isGroup ? `${d}@g.us` : d;
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
    if (dataStr.toLowerCase().includes("connection closed")) return { ok: false, error: "Instância WhatsApp desconectada no servidor" };
    if (dataStr.includes('"exists":false') || dataStr.includes('"exists": false')) return { ok: false, error: "Este número não possui WhatsApp" };
    return { ok: false, error: (data?.message || data?.error || `HTTP ${r.status}: ${text.slice(0, 120)}`) };
  }
  const remoteId = data?.key?.id || data?.data?.key?.id || data?.messageId || data?.id || null;
  return { ok: true, remoteId: remoteId ? String(remoteId) : null };
}

// Mesmo envio do whatsapp-official-api action=sendText.
async function sendOfficial(officialId: string, phone: string, message: string) {
  const { data: inst } = await supabase.from("whatsapp_official_instances")
    .select("id, display_name, phone_number_id, access_token").eq("id", officialId).maybeSingle();
  if (!inst?.phone_number_id || !inst?.access_token) return { ok: false, error: "Número oficial sem phone_number_id/token" };
  let r: Response;
  try {
    r = await fetch(`https://graph.facebook.com/v18.0/${inst.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${inst.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: digits(phone), type: "text", text: { body: message } }),
    });
  } catch (e) {
    return { ok: false, error: `Meta fora do ar: ${String(e).slice(0, 120)}` };
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: d?.error?.message || `HTTP ${r.status}` };
  return { ok: true, remoteId: d?.messages?.[0]?.id ? String(d.messages[0].id) : null };
}

// {{nome}}, {{primeiro_nome}}, {{telefone}}: mesmo vocabulário das respostas rápidas do chat.
function render(tpl: string, v: Record<string, string>) {
  return String(tpl || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in v ? v[k] : m));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SCHEDULED_SECRET");
  if (!secret || req.headers.get("x-scheduler-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const dry = !!body?.dry_run;
  const onlyId = typeof body?.id === "string" ? body.id : null;
  const nowIso = new Date().toISOString();

  // Reserva as pendentes vencidas (status 'sending') pra duas execuções não mandarem em dobro.
  let rows: any[] = [];
  if (dry) {
    let q = supabase.from("crm_scheduled_messages").select("*").eq("status", "pending").lte("scheduled_at", nowIso).order("scheduled_at").limit(LOTE);
    if (onlyId) q = supabase.from("crm_scheduled_messages").select("*").eq("id", onlyId).eq("status", "pending");
    rows = (await q).data || [];
  } else {
    let q = supabase.from("crm_scheduled_messages").update({ status: "sending", updated_at: nowIso }).eq("status", "pending").select("*");
    q = onlyId ? q.eq("id", onlyId) : q.lte("scheduled_at", nowIso);
    const { data, error } = await q;
    if (error) return json({ error: error.message }, 500);
    rows = (data || []).sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at))).slice(0, LOTE);
    // o que sobrou do lote volta pra pendente
    const sobra = (data || []).filter((r) => !rows.some((x) => x.id === r.id)).map((r) => r.id);
    if (sobra.length) await supabase.from("crm_scheduled_messages").update({ status: "pending" }).in("id", sobra);
  }

  const out: any[] = [];
  for (const row of rows) {
    const result: any = { id: row.id, scheduled_at: row.scheduled_at };
    try {
      // destino: pela conversa (preferido) ou pelos campos soltos da linha
      let instanceId: string | null = row.instance_id || null;
      let officialId: string | null = row.official_instance_id || null;
      let phone = row.phone_number;
      let contactName = "";
      let leadName = "";
      let conversationId: string | null = row.conversation_id || null;
      if (conversationId) {
        const { data: conv } = await supabase.from("crm_whatsapp_conversations")
          .select("id, instance_id, official_instance_id, merged_into, contact:crm_whatsapp_contacts(phone, name), lead:crm_leads(name)")
          .eq("id", conversationId).maybeSingle();
        if (conv) {
          if (conv.merged_into) conversationId = conv.merged_into; // conversa foi mesclada: grava na principal
          instanceId = conv.instance_id || instanceId;
          officialId = conv.instance_id ? null : (conv.official_instance_id || officialId);
          phone = (conv as any).contact?.phone || phone;
          contactName = (conv as any).contact?.name || "";
          leadName = (conv as any).lead?.name || "";
        }
      }
      const nome = (leadName || contactName || "").trim();
      const message = render(row.message, { nome, primeiro_nome: nome.split(/\s+/)[0] || "", telefone: digits(phone) });
      result.to = digits(phone); result.via = instanceId ? `evolution:${instanceId}` : officialId ? `official:${officialId}` : null;
      result.preview = message.slice(0, 80);

      if (!digits(phone)) throw new Error("Sem telefone de destino");
      if (!instanceId && !officialId) throw new Error("Conversa sem número (instância) associado");
      if (dry) { result.would_send = true; out.push(result); continue; }

      const sent = instanceId ? await sendEvolution(instanceId, phone, message) : await sendOfficial(officialId!, phone, message);
      let messageId: string | null = null;
      if (conversationId) {
        const { data: m } = await supabase.from("crm_whatsapp_messages").insert({
          conversation_id: conversationId,
          content: message,
          type: "text",
          direction: "outbound",
          status: sent.ok ? "sent" : "failed",
          sent_by: row.created_by || null,
          remote_id: sent.ok ? (sent as any).remoteId : null,
          whatsapp_message_id: sent.ok ? (sent as any).remoteId : null,
          error_text: sent.ok ? null : (sent as any).error,
        }).select("id").single();
        messageId = m?.id || null;
      }
      await supabase.from("crm_scheduled_messages").update({
        status: sent.ok ? "sent" : "failed",
        sent_at: sent.ok ? new Date().toISOString() : null,
        error_message: sent.ok ? null : (sent as any).error,
        sent_message_id: messageId,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      result.ok = sent.ok; result.error = sent.ok ? undefined : (sent as any).error; result.message_id = messageId;
    } catch (e) {
      const err = String((e as any)?.message || e).slice(0, 500);
      if (!dry) await supabase.from("crm_scheduled_messages").update({ status: "failed", error_message: err, updated_at: new Date().toISOString() }).eq("id", row.id);
      result.ok = false; result.error = err;
    }
    out.push(result);
  }
  return json({ ok: true, dry_run: dry, processed: out.length, results: out });
});
