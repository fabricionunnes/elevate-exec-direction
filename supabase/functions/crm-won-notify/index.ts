// Notificação de VENDA GANHA no grupo de WhatsApp (Integração novos clientes).
// SERVER-SIDE: disparada por trigger no banco quando o lead entra em Ganho —
// funciona em QUALQUER caminho (botão, kanban, automação, agente), sem depender
// do navegador do usuário. Idempotente via crm_won_notifications (1 por lead).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const brl = (v: number | null) =>
  v == null ? "Não informado" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

const fmtPhone = (p: string | null) => {
  if (!p) return "Não informado";
  const c = p.replace(/\D/g, "");
  if (c.length === 11) return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
  if (c.length === 10) return `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`;
  return p;
};

const fmtCNPJ = (d: string | null) => {
  if (!d) return "Não informado";
  const c = d.replace(/\D/g, "");
  if (c.length === 14) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
  return d;
};

const fmtCEP = (z: string | null) => {
  if (!z) return "Não informado";
  const c = z.replace(/\D/g, "");
  if (c.length === 8) return `${c.slice(0, 5)}-${c.slice(5)}`;
  return z;
};

async function sendGroupText(supabase: any, instanceId: string, groupJid: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("instance_name, api_url, api_key, provider_type")
    .eq("id", instanceId)
    .maybeSingle();
  if (!instance) return { ok: false, error: "instância não encontrada" };
  const apiUrl = instance.api_url || Deno.env.get("EVOLUTION_API_URL");
  const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY");
  if (!apiUrl || !apiKey) return { ok: false, error: "sem credenciais" };
  const baseUrl = String(apiUrl).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
  let isV2 = instance.provider_type === "manager_v2";
  try { if (!isV2) isV2 = new URL(baseUrl).hostname.toLowerCase().endsWith(".stevo.chat"); } catch { /* legado */ }
  const gid = groupJid.includes("@g.us") ? groupJid : `${groupJid}@g.us`;
  const url = isV2 ? `${baseUrl}/send/text` : `${baseUrl}/message/sendText/${instance.instance_name}`;
  const headers: Record<string, string> = isV2
    ? { "Content-Type": "application/json", apikey: apiKey }
    : { "Content-Type": "application/json", apikey: apiKey, Authorization: `Bearer ${apiKey}` };
  const payload = isV2 ? { number: gid, text: message, delay: 0 } : { number: gid, text: message };
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!r.ok) return { ok: false, error: `HTTP ${r.status}: ${(await r.text()).slice(0, 150)}` };
  await r.text();
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const body = await req.json().catch(() => ({}));
    const leadId: string = body.lead_id;
    const force: boolean = !!body.force;
    if (!leadId) return j({ ok: false, error: "lead_id obrigatório" }, 400);

    // Idempotência: 1 notificação por lead (reganho não repete, salvo force)
    const { data: already } = await supabase
      .from("crm_won_notifications")
      .select("lead_id")
      .eq("lead_id", leadId)
      .maybeSingle();
    if (already && !force) return j({ ok: true, skip: "já notificado" });

    // Config
    const { data: settings } = await supabase
      .from("crm_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["won_notification_enabled", "won_notification_instance_id", "won_notification_group_jid"]);
    const cfg: Record<string, string> = {};
    (settings || []).forEach((s: any) => {
      const v = typeof s.setting_value === "string" ? s.setting_value : JSON.stringify(s.setting_value).replace(/^"|"$/g, "");
      cfg[s.setting_key] = v;
    });
    if (cfg.won_notification_enabled !== "true") return j({ ok: true, skip: "desativado" });
    if (!cfg.won_notification_instance_id || !cfg.won_notification_group_jid) {
      return j({ ok: false, error: "configuração incompleta" });
    }

    // Lead completo
    const { data: lead } = await supabase
      .from("crm_leads")
      .select(`
        *,
        closer:onboarding_staff!crm_leads_closer_staff_id_fkey(name),
        owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name),
        sdr:onboarding_staff!crm_leads_sdr_staff_id_fkey(name),
        product:onboarding_services!crm_leads_product_id_fkey(name),
        plan:crm_plans!crm_leads_plan_id_fkey(name)
      `)
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return j({ ok: false, error: "lead não encontrado" });

    // SDR que agendou (evento) → fallback SDR do lead
    let schedulerSdrName: string | null = null;
    const { data: ev } = await supabase
      .from("crm_meeting_events")
      .select("triggered_by_staff_id")
      .eq("lead_id", leadId)
      .eq("event_type", "scheduled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ev?.triggered_by_staff_id) {
      const { data: st } = await supabase.from("onboarding_staff").select("name").eq("id", ev.triggered_by_staff_id).maybeSingle();
      schedulerSdrName = st?.name || null;
    }

    // Forma de pagamento (id → nome)
    let paymentName: string | null = lead.payment_method;
    if (lead.payment_method) {
      const { data: pm } = await supabase.from("crm_payment_method_options").select("name").eq("id", lead.payment_method).maybeSingle();
      if (pm?.name) paymentName = pm.name;
    }

    // Briefing (notes ou campo custom)
    let briefing: string | null = lead.notes;
    if (!briefing) {
      const { data: bf } = await supabase
        .from("crm_custom_fields").select("id").eq("field_name", "briefing").eq("context", "deal").maybeSingle();
      if (bf?.id) {
        const { data: bv } = await supabase
          .from("crm_custom_field_values").select("value").eq("lead_id", leadId).eq("field_id", bf.id).maybeSingle();
        briefing = bv?.value || null;
      }
    }

    const closedAt = lead.closed_at ? new Date(lead.closed_at) : new Date();
    const dataBR = closedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const sdrName = schedulerSdrName || lead.sdr?.name || "Não informado";
    // Venda é do RESPONSÁVEL do lead
    const closerName = lead.owner?.name || lead.closer?.name || "Não informado";

    const lines: string[] = [
      "🎉 *NOVA VENDA FECHADA!* 🎉",
      "",
      `📅 *Data:* ${dataBR}`,
      `👥 *SDR:* ${sdrName}`,
      `👔 *Closer:* ${closerName}`,
      "",
      "📋 *DADOS DO NEGÓCIO*",
      `🏢 *Serviço:* ${lead.product?.name || "Não informado"}`,
      `🏪 *Empresa:* ${lead.company || "Não informado"}`,
    ];
    if (lead.trade_name) lines.push(`📝 *Nome Fantasia:* ${lead.trade_name}`);
    lines.push(`📄 *CNPJ:* ${fmtCNPJ(lead.document)}`);
    lines.push(`🏷️ *Segmento:* ${lead.segment || "Não informado"}`);
    lines.push(`📦 *Plano:* ${lead.plan?.name || "Não informado"}`);
    lines.push("", "💰 *FINANCEIRO*");
    lines.push(`💵 *Valor:* ${brl(lead.opportunity_value)}`);
    if (lead.installments) lines.push(`🔢 *Parcelas:* ${lead.installments}`);
    if (lead.due_day) lines.push(`📆 *Vencimento:* Dia ${lead.due_day}`);
    if (paymentName) lines.push(`💳 *Forma:* ${paymentName}`);
    lines.push("", "👤 *CONTATO*");
    lines.push(`📛 *Nome:* ${lead.name || "Não informado"}`);
    lines.push(`📱 *Telefone:* ${fmtPhone(lead.phone)}`);
    lines.push(`✉️ *E-mail:* ${lead.email || "Não informado"}`);
    lines.push("", "📍 *ENDEREÇO*");
    if (lead.address) lines.push(`🏠 *Rua:* ${lead.address}`);
    lines.push(`🏙️ *Cidade:* ${lead.city || "Não informado"}`);
    lines.push(`🗺️ *Estado:* ${lead.state || "Não informado"}`);
    lines.push(`📮 *CEP:* ${fmtCEP(lead.zipcode)}`);
    lines.push("", "🚀 *Parabéns à equipe!*");
    if (briefing) {
      const wb = briefing
        .replace(/^## (.+)/gm, "\n*$1*")
        .replace(/\*\*(.+?)\*\*/g, "*$1*")
        .replace(/^- /gm, "• ")
        .replace(/^> (.+)/gm, '  _"$1"_')
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      lines.push("", "📝 *BRIEFING*", wb);
    }

    const send = await sendGroupText(supabase, cfg.won_notification_instance_id, cfg.won_notification_group_jid, lines.join("\n"));
    if (!send.ok) return j({ ok: false, error: send.error });

    await supabase.from("crm_won_notifications").upsert({
      lead_id: leadId,
      group_jid: cfg.won_notification_group_jid,
      sent_at: new Date().toISOString(),
    });
    return j({ ok: true, sent: true });
  } catch (e) {
    console.error("crm-won-notify", e);
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
