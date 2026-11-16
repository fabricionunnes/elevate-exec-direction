import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Duas contas (12/11/2026): a da UNV (MERCADOPAGO_ACCESS_TOKEN) e a "Mercado Pago Yas",
// da empresa da Yasmim (MERCADOPAGO_YAS_ACCESS_TOKEN). O front manda account: "yas" pra segunda.
const TOKENS: Record<string, string> = {
  unv: Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "",
  // o segredo foi salvo como MERCADOPAGOYAS no painel (12/11); aceita os dois nomes
  yas: Deno.env.get("MERCADOPAGO_YAS_ACCESS_TOKEN") || Deno.env.get("MERCADOPAGOYAS") || "",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "use POST" }, 405);

  // Precisa estar autenticado (staff logado). O front chama via functions.invoke.
  const auth = req.headers.get("authorization") || "";
  if (!auth) return j({ ok: false, error: "não autenticado" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any;
  try { body = await req.json(); } catch { return j({ ok: false, error: "JSON inválido" }); }
  const account = body?.account === "yas" ? "yas" : "unv";
  const MP_TOKEN = TOKENS[account];
  if (!MP_TOKEN) return j({ ok: false, error: account === "yas" ? "Mercado Pago Yas não configurado (falta o token da conta da Yasmim no servidor)" : "Mercado Pago não configurado (falta o token no servidor)" });

  // === Cobrança de empresa (recorrência do Financeiro), 16/11/2026 ===
  // Fabrício: "aqui quero poder gerar cobrança via cartão de crédito da conta da yasmim do mercado pago".
  // Gera um link de cartão (Checkout Pro) pra cada parcela em aberto da recorrência e grava na parcela.
  // A baixa vem pelo mercadopago-webhook (external_reference "inv:<id da parcela>").
  if (body?.recurring_charge_id || body?.invoice_id) {
    const jwt = auth.replace(/^Bearer\s+/i, "").trim();
    const { data: u } = await supabase.auth.getUser(jwt);
    if (!u?.user) return j({ ok: false, error: "não autenticado" }, 401);
    const { data: staff } = await supabase.from("onboarding_staff").select("id").eq("user_id", u.user.id).eq("is_active", true).limit(1);
    if (!staff?.length) return j({ ok: false, error: "sem permissão" }, 403);
    return await linksDaRecorrencia(supabase, body, account, MP_TOKEN);
  }

  const { lead_id } = body;
  if (!lead_id) return j({ ok: false, error: "lead_id obrigatório" });

  const { data: lead } = await supabase
    .from("crm_leads")
    .select("id, name, phone, opportunity_value")
    .eq("id", lead_id).maybeSingle();
  if (!lead) return j({ ok: false, error: "lead não encontrado" });

  // Valor: do corpo (centavos) ou do valor do negócio (opportunity_value em reais)
  const amountCents = Number.isFinite(Number(body.amount_cents)) && Number(body.amount_cents) > 0
    ? Math.round(Number(body.amount_cents))
    : Math.round(Number(lead.opportunity_value || 0) * 100);
  if (!amountCents || amountCents < 100) return j({ ok: false, error: "valor inválido (mínimo R$ 1,00)" });

  const description = String(body.description || `Pagamento — ${lead.name || "Cliente"}`).slice(0, 240);
  const installments = Math.max(1, Math.min(12, Math.round(Number(body.installments) || 12)));

  // 1) Cria a linha de pagamento (pra usar o id como referência externa)
  const { data: row, error: insErr } = await supabase.from("crm_lead_payments").insert({
    lead_id, amount_cents: amountCents, description, provider: account === "yas" ? "mercadopago_yas" : "mercadopago",
    status: "pending", installments,
  }).select("id").single();
  if (insErr || !row) return j({ ok: false, error: "falha ao registrar pagamento" }, 500);

  // 2) Cria a preferência no Mercado Pago (Checkout Pro)
  const pref = {
    items: [{ title: description, quantity: 1, currency_id: "BRL", unit_price: amountCents / 100 }],
    external_reference: row.id,
    notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook${account === "yas" ? "?account=yas" : ""}`,
    payment_methods: { installments },
    metadata: { lead_id, payment_row: row.id, account },
  };
  const mpResp = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(pref),
  });
  const mpData = await mpResp.json();
  if (!mpResp.ok) {
    await supabase.from("crm_lead_payments").update({ status: "error" }).eq("id", row.id);
    return j({ ok: false, error: mpData?.message || "Mercado Pago recusou", detail: mpData });
  }

  const url = mpData.init_point || mpData.sandbox_init_point;

  // O lançamento no Financeiro só acontece quando o pagamento é confirmado
  // (mercadopago-webhook cria o recebível já pago) — link gerado não polui
  // o Contas a Receber.
  await supabase.from("crm_lead_payments").update({
    provider_ref: String(mpData.id), url, updated_at: new Date().toISOString(),
  }).eq("id", row.id);

  return j({ ok: true, id: row.id, url, amount_cents: amountCents });
});

const PROVIDER: Record<string, string> = { unv: "mercadopago", yas: "mercadopago_yas" };

async function criarPreferencia(token: string, pref: Record<string, unknown>) {
  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(pref),
  });
  let d: any = {};
  try { d = await r.json(); } catch { /* noop */ }
  return { ok: r.ok, d };
}

async function linksDaRecorrencia(supabase: any, body: any, account: string, token: string) {
  const maxParcelas = Math.max(1, Math.min(12, Math.round(Number(body.installments) || 12)));
  const refazer = body.refazer === true; // gera link novo mesmo se a parcela já tem um do Mercado Pago

  let q = supabase.from("company_invoices")
    .select("id, company_id, recurring_charge_id, description, amount_cents, due_date, status, installment_number, total_installments, payment_link_id, payment_link_url")
    .in("status", ["pending", "overdue"]).order("due_date", { ascending: true }).limit(60);
  q = body.invoice_id ? q.eq("id", String(body.invoice_id)) : q.eq("recurring_charge_id", String(body.recurring_charge_id));
  const { data: invoices, error } = await q;
  if (error) return j({ ok: false, error: error.message }, 500);
  if (!invoices?.length) return j({ ok: false, error: "nenhuma parcela em aberto pra gerar link" });

  const chargeId = invoices[0].recurring_charge_id as string | null;
  const { data: charge } = chargeId
    ? await supabase.from("company_recurring_charges").select("id, customer_name, customer_email").eq("id", chargeId).maybeSingle()
    : { data: null };

  const links: { invoice_id: string; due_date: string; url: string }[] = [];
  const erros: string[] = [];
  for (const inv of invoices) {
    const jaTem = String(inv.payment_link_url || "");
    if (!refazer && /mercadopago|mercadolivre|mpago\./i.test(jaTem)) { links.push({ invoice_id: inv.id, due_date: inv.due_date, url: jaTem }); continue; }
    const parc = inv.total_installments > 1 ? ` (${inv.installment_number}/${inv.total_installments})` : "";
    const base: Record<string, unknown> = {
      items: [{ title: `${String(inv.description || "Mensalidade").slice(0, 220)}${parc}`, quantity: 1, currency_id: "BRL", unit_price: inv.amount_cents / 100 }],
      external_reference: `inv:${inv.id}`,
      notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook${account === "yas" ? "?account=yas" : ""}`,
      metadata: { invoice_id: inv.id, company_id: inv.company_id, account },
    };
    if (charge?.customer_email) base.payer = { email: charge.customer_email, name: charge.customer_name || undefined };
    // Só cartão: tira boleto, Pix e lotérica. Se o Mercado Pago recusar a restrição, gera sem ela.
    let r = await criarPreferencia(token, { ...base, payment_methods: { installments: maxParcelas, excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }, { id: "atm" }] } });
    if (!r.ok) r = await criarPreferencia(token, { ...base, payment_methods: { installments: maxParcelas } });
    const url = r.d?.init_point || r.d?.sandbox_init_point;
    if (!r.ok || !url) { erros.push(`${inv.due_date}: ${r.d?.message || "Mercado Pago recusou"}`); continue; }

    if (inv.payment_link_id) {
      await supabase.from("payment_links").update({ url, provider: PROVIDER[account], payment_method: "credit_card", installments: maxParcelas }).eq("id", inv.payment_link_id);
      await supabase.from("company_invoices").update({ payment_link_url: url, payment_method: "credit_card" }).eq("id", inv.id);
    } else {
      const { data: pl } = await supabase.from("payment_links").insert({
        description: inv.description || "Fatura", amount_cents: inv.amount_cents, payment_method: "credit_card",
        installments: maxParcelas, url, company_id: inv.company_id, provider: PROVIDER[account],
      }).select("id").single();
      await supabase.from("company_invoices").update({ payment_link_url: url, payment_link_id: pl?.id || null, payment_method: "credit_card" }).eq("id", inv.id);
    }
    links.push({ invoice_id: inv.id, due_date: inv.due_date, url });
  }

  if (chargeId && links.length) {
    await supabase.from("company_recurring_charges").update({ pagarme_link_id: PROVIDER[account], pagarme_link_url: links[0].url }).eq("id", chargeId);
  }
  if (!links.length) return j({ ok: false, error: erros[0] || "não consegui gerar o link", erros });
  return j({ ok: true, url: links[0].url, links, erros });
}
