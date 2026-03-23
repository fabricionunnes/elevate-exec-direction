import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DOM_API_URL = "https://apiv3.dompagamentos.com.br/checkout/production";
const DOM_FAILURE_STATUSES = new Set([
  "error",
  "failed",
  "failure",
  "declined",
  "denied",
  "refused",
  "canceled",
  "cancelled",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SECRET_KEY = Deno.env.get("DOMPAGAMENTOS_SECRET_KEY");
    const PUBLIC_KEY = Deno.env.get("DOMPAGAMENTOS_PUBLIC_KEY");

    if (!SECRET_KEY) {
      throw new Error("DOMPAGAMENTOS_SECRET_KEY not configured");
    }

    const body = await req.json();

    if (body.get_public_key === true) {
      return new Response(
        JSON.stringify({ public_key: PUBLIC_KEY || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.test_key === true) {
      const testResp = await fetch(`${DOM_API_URL}/transactions?page=1&per_page=1`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SECRET_KEY}`,
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

    const domPayload: Record<string, unknown> = {
      amount: amount_cents,
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

      if (card_token) {
        domPayload.card = {
          token: card_token,
          bin: card_bin || undefined,
          brand: card_brand || undefined,
          installments,
          interest_free: interest_free_installments >= installments,
        };
      } else {
        domPayload.installments = installments;
        domPayload.interest_free_installments = interest_free_installments;
      }
    }

    console.log("Dom Pagamentos payload:", JSON.stringify(domPayload));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const domResponse = await fetch(`${DOM_API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SECRET_KEY}`,
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
    console.log("Dom Pagamentos response:", JSON.stringify(domData));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const normalizedStatus = String(domData.status || (domResponse.ok ? "pending" : "error")).toLowerCase();
    const providerMessage = domData.message || domData.error || domData.details || null;
    const missingTransactionId = !domData.id && payment_method === "credit_card" && !domData.checkout_url && !domData.payment_url;
    const isProviderFailure = DOM_FAILURE_STATUSES.has(normalizedStatus) || missingTransactionId;
    const isPaid = normalizedStatus === "paid" || normalizedStatus === "authorized";

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
      status: isPaid ? "paid" : isProviderFailure ? "failed" : normalizedStatus,
      pagarme_order_id: domData.id ? String(domData.id) : null,
      pagarme_charge_id: domData.id ? String(domData.id) : null,
      payment_link_id: payment_link_id || null,
      invoice_url: domData.checkout_url || domData.payment_url || null,
      metadata: domData,
    };

    if (payment_method === "pix") {
      orderData.pix_qr_code = domData.pix_content || null;
      orderData.pix_qr_code_url = domData.pix_qrcode || null;
      orderData.pix_expires_at = domData.pix_expire || null;
    }

    if (payment_method === "boleto") {
      orderData.boleto_url = domData.boleto_url || null;
      orderData.boleto_barcode = domData.boleto_barcode || domData.digitable_line || null;
    }

    await supabase.from("pagarme_orders").insert(orderData);

    if (!domResponse.ok || isProviderFailure) {
      console.error("Dom Pagamentos charge rejected:", JSON.stringify(domData));
      return new Response(
        JSON.stringify({
          error: "Pagamento recusado pela Dom Pagamentos",
          details: providerMessage || "A operadora não autorizou a cobrança no cartão.",
          status: normalizedStatus || "error",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const response: Record<string, unknown> = {
      success: true,
      order_id: String(domData.id),
      status: normalizedStatus,
      payment_method,
    };

    if (payment_method === "pix") {
      response.pix_qr_code = domData.pix_content || null;
      response.pix_qr_code_url = domData.pix_qrcode || null;
      response.pix_expires_at = domData.pix_expire || null;
    }

    if (payment_method === "boleto") {
      response.boleto_url = domData.boleto_url || null;
      response.boleto_barcode = domData.boleto_barcode || domData.digitable_line || null;
    }

    if (payment_method === "credit_card") {
      response.paid = isPaid;
      response.checkout_url = domData.checkout_url || domData.payment_url || null;
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Dom Pagamentos Checkout error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
