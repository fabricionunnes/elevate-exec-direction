import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DOM_API_URL = "https://apiv3.dompagamentos.com.br/checkout/production";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SECRET_KEY = Deno.env.get("DOMPAGAMENTOS_SECRET_KEY");
    if (!SECRET_KEY) {
      throw new Error("DOMPAGAMENTOS_SECRET_KEY not configured");
    }

    const body = await req.json();

    // Test mode - validate the key
    if (body.test_key === true) {
      const testResp = await fetch(`${DOM_API_URL}/transactions?page=1&per_page=1`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SECRET_KEY}`,
        },
      });
      return new Response(
        JSON.stringify({ key_valid: testResp.ok, status: testResp.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      customer_name,
      customer_email,
      customer_phone,
      customer_document,
      product_id,
      product_name,
      amount_cents,
      payment_method,
      installments = 1,
      interest_free_installments = 0,
      card_token,
      card_bin,
      card_brand,
      payment_link_id,
    } = body;

    if (!customer_name || !customer_email || !amount_cents || !payment_method) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando: customer_name, customer_email, amount_cents, payment_method" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanDoc = (customer_document || "").replace(/\D/g, "");
    const cleanPhone = (customer_phone || "").replace(/\D/g, "");

    // Build Dom Pagamentos transaction payload
    const domPayload: Record<string, unknown> = {
      amount: amount_cents, // Dom uses cents
      currency: "BRL",
      cod_external: payment_link_id || product_id || crypto.randomUUID(),
      customer: {
        name: customer_name,
        email: customer_email,
        phone: cleanPhone || undefined,
        document: cleanDoc || undefined,
      },
      items: [
        {
          description: product_name || "Pagamento",
          quantity: 1,
          unit_price: amount_cents,
        },
      ],
    };

    if (payment_method === "pix") {
      domPayload.payment_method = "pix";
    } else if (payment_method === "boleto") {
      domPayload.payment_method = "boleto";
    } else if (payment_method === "credit_card") {
      domPayload.payment_method = "credit_card";
      if (!card_token) {
        return new Response(
          JSON.stringify({ error: "Token do cartão é obrigatório. Tokenize o cartão no frontend antes de enviar." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      domPayload.card = {
        token: card_token,
        bin: card_bin || undefined,
        brand: card_brand || undefined,
        installments: installments,
        interest_free: interest_free_installments >= installments,
      };
    }

    console.log("Dom Pagamentos payload:", JSON.stringify(domPayload));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const domResponse = await fetch(`${DOM_API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SECRET_KEY}`,
      },
      body: JSON.stringify(domPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = domResponse.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      const text = await domResponse.text();
      console.error("Dom Pagamentos non-JSON response:", text.substring(0, 300));
      throw new Error("Dom Pagamentos retornou resposta inválida. Tente novamente.");
    }

    const domData = await domResponse.json();

    if (!domResponse.ok) {
      console.error("Dom Pagamentos error:", JSON.stringify(domData));
      return new Response(
        JSON.stringify({
          error: "Erro ao processar pagamento na Dom Pagamentos",
          details: domData.message || domData.error || JSON.stringify(domData),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save to database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const isPaid = domData.status === "paid" || domData.status === "authorized";

    const orderData: Record<string, unknown> = {
      customer_name,
      customer_email,
      customer_phone,
      customer_document,
      product_id: product_id || null,
      product_name,
      amount_cents,
      payment_method,
      installments,
      provider: "dompagamentos",
      status: isPaid ? "paid" : "pending",
      pagarme_order_id: String(domData.id),
      pagarme_charge_id: String(domData.id),
      payment_link_id: payment_link_id || null,
    };

    // PIX data
    if (payment_method === "pix") {
      orderData.pix_qr_code = domData.pix_content || null;
      orderData.pix_qr_code_url = domData.pix_qrcode || null;
      orderData.pix_expires_at = domData.pix_expire || null;
    }

    // Boleto data
    if (payment_method === "boleto") {
      orderData.boleto_url = domData.boleto_url || null;
    }

    await supabase.from("pagarme_orders").insert(orderData);

    // If paid immediately (credit card), update invoice
    if (isPaid && payment_link_id) {
      await supabase
        .from("company_invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          paid_amount_cents: amount_cents,
        })
        .eq("payment_link_id", payment_link_id);
    }

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      order_id: String(domData.id),
      status: domData.status,
      payment_method,
    };

    if (payment_method === "pix") {
      response.pix_qr_code = domData.pix_content || null;
      response.pix_qr_code_url = domData.pix_qrcode || null;
      response.pix_expires_at = domData.pix_expire || null;
    }

    if (payment_method === "boleto") {
      response.boleto_url = domData.boleto_url || null;
    }

    if (payment_method === "credit_card") {
      response.paid = isPaid;
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Dom Pagamentos Checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
