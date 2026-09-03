// Cria uma preferência de Checkout Pro no Mercado Pago (conta do UNV Nexus)
// pra venda de ingresso do site da Mansão Empreendedora. Só cartão (PIX fica no Asaas).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};
const FALLBACK_TOKEN = "656a7068f01d8920fe9167279dcb14d19d7b6d09cb9bbcc7";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const expected = Deno.env.get("MANSAO_HOOK_TOKEN") || FALLBACK_TOKEN;
    if (req.headers.get("x-api-key") !== expected) return json({ error: "Unauthorized" }, 401);

    const ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) return json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado no Nexus" }, 500);

    const { orderId, title, amount, payer, successUrl, failureUrl, notificationUrl } = await req.json();
    if (!orderId || !amount || !successUrl) return json({ error: "orderId, amount e successUrl obrigatórios" }, 400);

    const [firstName, ...rest] = String(payer?.name || "Cliente").trim().split(" ");
    const cpf = String(payer?.cpf || "").replace(/\D/g, "");

    const preference = {
      items: [{
        id: orderId,
        title: title || "Mansão Empreendedora - Ingresso",
        quantity: 1,
        unit_price: Number(amount),
        currency_id: "BRL",
      }],
      payer: {
        name: firstName,
        surname: rest.join(" ") || undefined,
        email: payer?.email || undefined,
        identification: cpf ? { type: "CPF", number: cpf } : undefined,
      },
      external_reference: orderId,
      back_urls: { success: successUrl, failure: failureUrl || successUrl, pending: successUrl },
      auto_return: "approved",
      notification_url: notificationUrl,
      statement_descriptor: "MANSAO EMPREEND",
      // Só cartão de crédito: PIX/boleto continuam pelo Asaas
      payment_methods: {
        excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }, { id: "atm" }, { id: "debit_card" }],
        installments: 12,
      },
      metadata: { origem: "site-mansao", order_id: orderId },
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
      body: JSON.stringify(preference),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[mansao-mp-preference] MP error:", JSON.stringify(data));
      return json({ error: "Erro ao criar pagamento no Mercado Pago", details: data }, 400);
    }
    return json({ success: true, preferenceId: data.id, initPoint: data.init_point });
  } catch (e) {
    console.error("[mansao-mp-preference]", e);
    return json({ error: String(e) }, 500);
  }
});
