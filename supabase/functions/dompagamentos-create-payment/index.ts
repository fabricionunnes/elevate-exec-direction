import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DOM_KEY = Deno.env.get("DOMPAGAMENTOS_SECRET_KEY") || "";
const DOM_API = "https://apiv3.dompagamentos.com.br/checkout/production";
const DOM_BANK = "bd12e32c-d943-40f9-9b25-27f9beaa987f"; // financial_banks: Dom Pagamentos
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "use POST" }, 405);
  if (!req.headers.get("authorization")) return j({ ok: false, error: "não autenticado" }, 401);
  if (!DOM_KEY) return j({ ok: false, error: "Dom Pagamentos não configurado (falta a chave no servidor)" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any;
  try { body = await req.json(); } catch { return j({ ok: false, error: "JSON inválido" }); }

  const { lead_id } = body;
  if (!lead_id) return j({ ok: false, error: "lead_id obrigatório" });

  const { data: lead } = await supabase.from("crm_leads")
    .select("id, name, email, phone, document, opportunity_value").eq("id", lead_id).maybeSingle();
  if (!lead) return j({ ok: false, error: "lead não encontrado" });

  const amountCents = Number.isFinite(Number(body.amount_cents)) && Number(body.amount_cents) > 0
    ? Math.round(Number(body.amount_cents)) : Math.round(Number(lead.opportunity_value || 0) * 100);
  if (!amountCents || amountCents < 100) return j({ ok: false, error: "valor inválido (mínimo R$ 1,00)" });

  const description = String(body.description || `Pagamento — ${lead.name || "Cliente"}`).slice(0, 240);
  const installments = Math.max(1, Math.min(12, Math.round(Number(body.installments) || 12)));
  const interestFree = Math.max(0, Math.min(installments, Math.round(Number(body.interest_free_installments) || installments)));

  // Registra o pagamento do lead
  const { data: row } = await supabase.from("crm_lead_payments").insert({
    lead_id, amount_cents: amountCents, description, provider: "dompagamentos",
    billing_type: "CREDIT_CARD", recurring: false, installments, status: "pending",
  }).select("id").single();
  if (!row) return j({ ok: false, error: "falha ao registrar pagamento" }, 500);

  // Cria a transação no Dom (cartão, parcelado). Sem card_token → gera link de checkout.
  const domPayload = {
    amount: amountCents,
    payment_method: "credit_card",
    installments,
    interest_free_installments: interestFree,
    external_reference: row.id,
    postback_url: `${SUPABASE_URL}/functions/v1/dompagamentos-webhook`,
    customer: {
      name: lead.name || "Cliente",
      email: lead.email || "sememail@unvholdings.com.br",
      document: String(lead.document || "").replace(/\D/g, "") || undefined,
      phone: String(lead.phone || "").replace(/\D/g, "") || undefined,
    },
    items: [{ title: description, quantity: 1, unit_price: amountCents }],
  };

  let domData: any = {};
  try {
    const resp = await fetch(`${DOM_API}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DOM_KEY}` },
      body: JSON.stringify(domPayload),
    });
    const text = await resp.text();
    try { domData = text ? JSON.parse(text) : {}; } catch { domData = {}; }
    if (!resp.ok) {
      await supabase.from("crm_lead_payments").update({ status: "error" }).eq("id", row.id);
      return j({ ok: false, error: domData?.message || domData?.error || `Dom recusou (HTTP ${resp.status})` });
    }
  } catch (e) {
    await supabase.from("crm_lead_payments").update({ status: "error" }).eq("id", row.id);
    return j({ ok: false, error: String((e as Error).message || e) });
  }

  const url = domData.checkout_url || domData.payment_url || "";
  if (!url) return j({ ok: false, error: "Dom não retornou link de checkout" });

  // Lançamento no Financeiro (a receber). Banco: Dom Pagamentos.
  const { data: rec } = await supabase.from("financial_receivables").insert({
    description, amount: amountCents / 100, due_date: new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10),
    status: "pending", payment_method: "CREDIT_CARD", payment_link: url, is_recurring: false,
    notes: `CRM · lead ${lead.name || lead_id}`,
  }).select("id").single();

  await supabase.from("crm_lead_payments").update({
    provider_ref: domData.id ? String(domData.id) : null, url, receivable_id: rec?.id || null, updated_at: new Date().toISOString(),
  }).eq("id", row.id);

  return j({ ok: true, id: row.id, url, amount_cents: amountCents });
});
