import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Conta da notificação: ?account=yas = "Mercado Pago Yas" (empresa da Yasmim); sem nada = conta da UNV.
const TOKENS: Record<string, string> = {
  unv: Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "",
  // o segredo foi salvo como MERCADOPAGOYAS no painel (12/11); aceita os dois nomes
  yas: Deno.env.get("MERCADOPAGO_YAS_ACCESS_TOKEN") || Deno.env.get("MERCADOPAGOYAS") || "",
};
const BANKS: Record<string, string> = {
  unv: "50d90f6e-e8e6-4dd7-87e9-3757ccda9842", // financial_banks: Mercado pago
  yas: "a4536364-73ff-4fa2-adea-7bdcbf5b61a2", // financial_banks: Mercado Pago Yas (fora do caixa)
};

// Mercado Pago manda notificação de pagamento. Buscamos o pagamento pela API,
// e se aprovado, marcamos a linha correspondente (external_reference) como paga.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const url = new URL(req.url);
    const account = url.searchParams.get("account") === "yas" ? "yas" : "unv";
    const MP_TOKEN = TOKENS[account];
    let paymentId = url.searchParams.get("data.id") || url.searchParams.get("id") || "";
    let topic = url.searchParams.get("type") || url.searchParams.get("topic") || "";
    try {
      const body = await req.json();
      paymentId = paymentId || String(body?.data?.id || body?.id || "");
      topic = topic || String(body?.type || body?.topic || "");
    } catch { /* pode vir só na query */ }

    // Só nos interessa evento de pagamento
    if (topic && !topic.includes("payment")) return new Response("ok");
    if (!paymentId || !MP_TOKEN) return new Response("ok");

    const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    if (!r.ok) return new Response("ok");
    const pay = await r.json();

    const extRef = pay?.external_reference;
    if (!extRef) return new Response("ok");

    const statusMap: Record<string, string> = {
      approved: "paid", pending: "pending", in_process: "pending",
      rejected: "rejected", cancelled: "cancelled", refunded: "refunded", charged_back: "chargeback",
    };
    const newStatus = statusMap[String(pay.status)] || "pending";
    const MP_BANK = BANKS[account];

    // valor líquido e taxa (MP informa)
    const gross = Math.round(Number(pay?.transaction_amount || 0) * 100);
    const net = Math.round(Number(pay?.transaction_details?.net_received_amount || pay?.transaction_amount || 0) * 100);
    const feeCents = Math.max(0, gross - net);

    // === Parcela de empresa (recorrência do Financeiro com link do Mercado Pago), 16/11/2026 ===
    if (String(extRef).startsWith("inv:")) {
      await baixaDaParcela(supabase, String(extRef).slice(4), newStatus, gross, net, feeCents, MP_BANK, account, String(paymentId));
      return new Response("ok");
    }

    const { data: lp } = await supabase.from("crm_lead_payments")
      .select("id, receivable_id, status, amount_cents, description, url, lead:crm_leads(name)").eq("id", extRef).maybeSingle();
    if (!lp) return new Response("ok");

    await supabase.from("crm_lead_payments").update({
      status: newStatus, payer_email: pay?.payer?.email || null,
      paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", extRef);

    // Só credita/baixa uma vez (quando vira pago e ainda não estava pago)
    if (newStatus === "paid" && lp.status !== "paid") {
      const today = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
      if (lp.receivable_id) {
        await supabase.from("financial_receivables").update({
          status: "paid", paid_date: today, paid_amount: net / 100, fee_amount: feeCents / 100, updated_at: new Date().toISOString(),
        }).eq("id", lp.receivable_id);
      } else {
        // Link não gera recebível ao ser criado — o lançamento nasce aqui,
        // já pago, quando o dinheiro de fato entra.
        const { data: rec } = await supabase.from("financial_receivables").insert({
          description: lp.description || `Pagamento — ${(lp as any).lead?.name || "lead CRM"}`,
          amount: (lp.amount_cents || gross) / 100, due_date: today,
          status: "paid", paid_date: today, paid_amount: net / 100, fee_amount: feeCents / 100,
          payment_method: "CREDIT_CARD", payment_link: lp.url || null, is_recurring: false,
          notes: `CRM · lead ${(lp as any).lead?.name || ""}`.trim(),
        }).select("id").single();
        if (rec?.id) await supabase.from("crm_lead_payments").update({ receivable_id: rec.id }).eq("id", lp.id);
      }
      // Crédito no banco Mercado Pago (já com a taxa descontada)
      await supabase.from("financial_bank_transactions").insert({
        bank_id: MP_BANK, type: "credit", amount_cents: net, fee_cents: feeCents,
        description: `Pagamento cartão (${account === "yas" ? "Mercado Pago Yas" : "Mercado Pago"}) — pagamento ${lp.id}`,
        reference_type: "crm_lead_payment", reference_id: lp.id,
      });
    }

    return new Response("ok");
  } catch (e) {
    console.error("mercadopago-webhook error", e);
    return new Response("ok"); // sempre 200 pro MP não reenviar em loop
  }
});

// Baixa da parcela (company_invoices) paga no cartão pelo Mercado Pago. O pagamento já foi conferido na
// API do Mercado Pago lá em cima; aqui só entra quando ele está aprovado e a parcela ainda não foi paga.
async function baixaDaParcela(supabase: any, invoiceId: string, newStatus: string, gross: number, net: number, feeCents: number, bankId: string, account: string, mpPaymentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return;
  const { data: inv } = await supabase.from("company_invoices")
    .select("id, company_id, status, amount_cents, due_date, description").eq("id", invoiceId).maybeSingle();
  if (!inv) { console.log(`[mercadopago-webhook] parcela ${invoiceId} não encontrada`); return; }
  if (newStatus !== "paid") { console.log(`[mercadopago-webhook] parcela ${invoiceId}: pagamento ${mpPaymentId} ${newStatus}`); return; }
  if (inv.status === "paid" || inv.status === "partial") { console.log(`[mercadopago-webhook] parcela ${invoiceId} já estava paga`); return; }

  const pago = gross > 0 ? gross : inv.amount_cents;
  // Trava de corrida: só segue quem conseguir virar a parcela pra paga
  const { data: virou } = await supabase.from("company_invoices").update({
    status: "paid", paid_at: new Date().toISOString(), paid_amount_cents: pago, payment_fee_cents: feeCents,
    bank_id: bankId, pagarme_charge_id: `mp:${mpPaymentId}`,
  }).eq("id", invoiceId).not("status", "in", '("paid","partial")').select("id");
  if (!virou?.length) return;

  const nomeConta = account === "yas" ? "Mercado Pago Yas" : "Mercado Pago";
  try { await supabase.rpc("increment_bank_balance", { p_bank_id: bankId, p_amount: net }); } catch (e) { console.error("[mercadopago-webhook] saldo do banco", e); }
  await supabase.from("financial_bank_transactions").insert({
    bank_id: bankId, type: "credit", amount_cents: net, fee_cents: feeCents,
    description: `Recebimento cartão (${nomeConta}): Fatura ${invoiceId}`, reference_type: "invoice", reference_id: invoiceId,
  });

  // Recebível do Financeiro com a mesma empresa, vencimento e valor
  try {
    const { data: rows } = await supabase.from("financial_receivables").select("id, amount")
      .eq("company_id", inv.company_id).eq("due_date", inv.due_date).not("status", "in", '("paid","cancelled")')
      .order("created_at", { ascending: true }).limit(10);
    const alvo = (rows || []).find((r: any) => Math.abs(Number(r.amount) - inv.amount_cents / 100) <= Math.max(1, inv.amount_cents / 100 * 0.02));
    if (alvo) {
      const today = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
      await supabase.from("financial_receivables").update({ status: "paid", paid_date: today, paid_amount: net / 100, fee_amount: feeCents / 100, updated_at: new Date().toISOString() }).eq("id", alvo.id);
    }
  } catch (e) { console.error("[mercadopago-webhook] recebível", e); }

  try { await supabase.functions.invoke("notify-payment-confirmed", { body: { invoice_id: invoiceId } }); } catch (e) { console.error("[mercadopago-webhook] aviso de pagamento", e); }
  console.log(`[mercadopago-webhook] parcela ${invoiceId} paga no ${nomeConta}: bruto ${gross}, líquido ${net}`);
}
