// Webhook do Mercado Pago pras vendas do site da Mansão Empreendedora.
// Confirma o pagamento na API do MP e avisa o backend da Mansão pra marcar o pedido como pago.
const MANSAO_CONFIRM_URL = "https://sfkdvvymexzashqudvso.supabase.co/functions/v1/mp-payment-confirmed";
const FALLBACK_TOKEN = "656a7068f01d8920fe9167279dcb14d19d7b6d09cb9bbcc7";

Deno.serve(async (req) => {
  const ok = () => new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* MP às vezes manda só query string */ }

    const type = (body.type as string) || url.searchParams.get("type") || url.searchParams.get("topic") || "";
    const dataId = (body.data as { id?: string })?.id || url.searchParams.get("data.id") || url.searchParams.get("id");
    console.log("[mansao-mp-webhook]", type, dataId);

    if (!type.startsWith("payment") || !dataId) return ok();

    const ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) { console.error("sem MERCADOPAGO_ACCESS_TOKEN"); return ok(); }

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    if (!res.ok) { console.error("payment fetch failed", res.status); return ok(); }
    const payment = await res.json();

    const orderId = payment.external_reference || payment.metadata?.order_id;
    if (!orderId || payment.metadata?.origem !== "site-mansao") return ok(); // não é venda do site

    const resp = await fetch(MANSAO_CONFIRM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("MANSAO_HOOK_TOKEN") || FALLBACK_TOKEN,
      },
      body: JSON.stringify({
        orderId,
        mpPaymentId: String(payment.id),
        status: payment.status,            // approved | pending | rejected | refunded | ...
        amount: payment.transaction_amount,
        installments: payment.installments,
      }),
    });
    console.log("[mansao-mp-webhook] confirm ->", resp.status, await resp.text());
    return ok();
  } catch (e) {
    console.error("[mansao-mp-webhook]", e);
    return ok();
  }
});
