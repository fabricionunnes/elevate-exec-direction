import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "use POST" }, 405);

  // Precisa estar autenticado (staff logado). O front chama via functions.invoke.
  const auth = req.headers.get("authorization") || "";
  if (!auth) return j({ ok: false, error: "não autenticado" }, 401);
  if (!MP_TOKEN) return j({ ok: false, error: "Mercado Pago não configurado (falta o token no servidor)" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any;
  try { body = await req.json(); } catch { return j({ ok: false, error: "JSON inválido" }, 400); }

  const { lead_id } = body;
  if (!lead_id) return j({ ok: false, error: "lead_id obrigatório" }, 400);

  const { data: lead } = await supabase
    .from("crm_leads")
    .select("id, name, phone, opportunity_value")
    .eq("id", lead_id).maybeSingle();
  if (!lead) return j({ ok: false, error: "lead não encontrado" }, 404);

  // Valor: do corpo (centavos) ou do valor do negócio (opportunity_value em reais)
  const amountCents = Number.isFinite(Number(body.amount_cents)) && Number(body.amount_cents) > 0
    ? Math.round(Number(body.amount_cents))
    : Math.round(Number(lead.opportunity_value || 0) * 100);
  if (!amountCents || amountCents < 100) return j({ ok: false, error: "valor inválido (mínimo R$ 1,00)" }, 400);

  const description = String(body.description || `Pagamento — ${lead.name || "Cliente"}`).slice(0, 240);
  const installments = Math.max(1, Math.min(12, Math.round(Number(body.installments) || 12)));

  // 1) Cria a linha de pagamento (pra usar o id como referência externa)
  const { data: row, error: insErr } = await supabase.from("crm_lead_payments").insert({
    lead_id, amount_cents: amountCents, description, provider: "mercadopago",
    status: "pending", installments,
  }).select("id").single();
  if (insErr || !row) return j({ ok: false, error: "falha ao registrar pagamento" }, 500);

  // 2) Cria a preferência no Mercado Pago (Checkout Pro)
  const pref = {
    items: [{ title: description, quantity: 1, currency_id: "BRL", unit_price: amountCents / 100 }],
    external_reference: row.id,
    notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
    payment_methods: { installments },
    metadata: { lead_id, payment_row: row.id },
  };
  const mpResp = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(pref),
  });
  const mpData = await mpResp.json();
  if (!mpResp.ok) {
    await supabase.from("crm_lead_payments").update({ status: "error" }).eq("id", row.id);
    return j({ ok: false, error: mpData?.message || "Mercado Pago recusou", detail: mpData }, 400);
  }

  const url = mpData.init_point || mpData.sandbox_init_point;
  await supabase.from("crm_lead_payments").update({
    provider_ref: String(mpData.id), url, updated_at: new Date().toISOString(),
  }).eq("id", row.id);

  return j({ ok: true, id: row.id, url, amount_cents: amountCents });
});
