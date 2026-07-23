import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";

// Mercado Pago manda notificação de pagamento. Buscamos o pagamento pela API,
// e se aprovado, marcamos a linha correspondente (external_reference) como paga.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const url = new URL(req.url);
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
    const MP_BANK = "50d90f6e-e8e6-4dd7-87e9-3757ccda9842"; // financial_banks: Mercado pago

    // valor líquido e taxa (MP informa)
    const gross = Math.round(Number(pay?.transaction_amount || 0) * 100);
    const net = Math.round(Number(pay?.transaction_details?.net_received_amount || pay?.transaction_amount || 0) * 100);
    const feeCents = Math.max(0, gross - net);

    const { data: lp } = await supabase.from("crm_lead_payments")
      .select("id, receivable_id, status, amount_cents").eq("id", extRef).maybeSingle();
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
      }
      // Crédito no banco Mercado Pago (já com a taxa descontada)
      await supabase.from("financial_bank_transactions").insert({
        bank_id: MP_BANK, type: "credit", amount_cents: net, fee_cents: feeCents,
        description: `Pagamento cartão (Mercado Pago) — pagamento ${lp.id}`,
        reference_type: "crm_lead_payment", reference_id: lp.id,
      });
    }

    return new Response("ok");
  } catch (e) {
    console.error("mercadopago-webhook error", e);
    return new Response("ok"); // sempre 200 pro MP não reenviar em loop
  }
});
