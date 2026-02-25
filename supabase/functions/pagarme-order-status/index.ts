const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAGARME_API_KEY = Deno.env.get("PAGARME_API_KEY");
    if (!PAGARME_API_KEY) {
      throw new Error("PAGARME_API_KEY not configured");
    }

    const { order_id } = await req.json();
    if (!order_id) {
      throw new Error("order_id is required");
    }

    const authHeader = btoa(PAGARME_API_KEY + ":");

    // Get order details from Pagar.me
    const response = await fetch(`https://api.pagar.me/core/v5/orders/${order_id}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Pagar.me error:", errorText);
      throw new Error(`Pagar.me API error: ${response.status}`);
    }

    const order = await response.json();

    // Extract charges/transactions info
    const charges = (order.charges || []).map((charge: any) => ({
      id: charge.id,
      status: charge.status,
      amount: charge.amount,
      paid_amount: charge.paid_amount,
      payment_method: charge.payment_method,
      paid_at: charge.paid_at,
      created_at: charge.created_at,
      last_transaction: charge.last_transaction ? {
        id: charge.last_transaction.id,
        status: charge.last_transaction.status,
        amount: charge.last_transaction.amount,
        installments: charge.last_transaction.installments,
        acquirer_message: charge.last_transaction.acquirer_message,
        gateway_response: charge.last_transaction.gateway_response,
      } : null,
    }));

    return new Response(
      JSON.stringify({
        order_id: order.id,
        status: order.status,
        amount: order.amount,
        closed: order.closed,
        created_at: order.created_at,
        updated_at: order.updated_at,
        charges,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
