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

    await supabase.from("crm_lead_payments").update({
      status: newStatus,
      payer_email: pay?.payer?.email || null,
      paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", extRef);

    return new Response("ok");
  } catch (e) {
    console.error("mercadopago-webhook error", e);
    return new Response("ok"); // sempre 200 pro MP não reenviar em loop
  }
});
