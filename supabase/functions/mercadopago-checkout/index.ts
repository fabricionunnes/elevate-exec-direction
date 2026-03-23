import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function createCardToken(
  accessToken: string,
  cardNumber: string,
  cardExpiry: string,
  cardCvv: string,
  cardHolder: string,
  customerDoc: string
): Promise<string> {
  const [expMonth, expYear] = cardExpiry.split("/");
  const fullYear = expYear.length === 2 ? `20${expYear}` : expYear;

  const tokenPayload = {
    card_number: cardNumber.replace(/\s/g, ""),
    expiration_month: parseInt(expMonth, 10),
    expiration_year: parseInt(fullYear, 10),
    security_code: cardCvv,
    cardholder: {
      name: cardHolder,
      identification: {
        type: customerDoc.length > 11 ? "CNPJ" : "CPF",
        number: customerDoc,
      },
    },
  };

  const resp = await fetch("https://api.mercadopago.com/v1/card_tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(tokenPayload),
  });

  const contentType = resp.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const text = await resp.text();
    console.error("Card token non-JSON response:", text.substring(0, 200));
    throw new Error("Erro ao tokenizar cartão no Mercado Pago");
  }

  const data = await resp.json();
  if (!resp.ok) {
    console.error("Card token error:", JSON.stringify(data));
    throw new Error(data.message || "Erro ao tokenizar cartão");
  }

  return data.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
    }

    const body = await req.json();

    // Test mode
    if (body.test_key === true) {
      const testResp = await fetch("https://api.mercadopago.com/v1/payment_methods", {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
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
      card_number,
      card_expiry,
      card_cvv,
      card_holder,
      card_token,
      payment_link_id,
    } = body;

    if (!customer_name || !customer_email || !product_id || !amount_cents || !payment_method) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountDecimal = amount_cents / 100;
    const cleanDoc = (customer_document || "").replace(/\D/g, "");
    const cleanPhone = (customer_phone || "").replace(/\D/g, "");

    // Build payment payload
    const mpPayload: Record<string, unknown> = {
      transaction_amount: amountDecimal,
      description: product_name,
      external_reference: payment_link_id || product_id,
      payer: {
        email: customer_email,
        first_name: customer_name.split(" ")[0],
        last_name: customer_name.split(" ").slice(1).join(" ") || customer_name.split(" ")[0],
        identification: cleanDoc ? {
          type: cleanDoc.length > 11 ? "CNPJ" : "CPF",
          number: cleanDoc,
        } : undefined,
        phone: cleanPhone ? {
          area_code: cleanPhone.substring(0, 2),
          number: cleanPhone.substring(2),
        } : undefined,
      },
    };

    if (payment_method === "pix") {
      mpPayload.payment_method_id = "pix";
    } else if (payment_method === "boleto") {
      mpPayload.payment_method_id = "bolbradesco";
      mpPayload.date_of_expiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    } else if (payment_method === "credit_card") {
      // Tokenize card server-side if raw card data was sent
      let resolvedToken = card_token;
      if (!resolvedToken && card_number && card_expiry && card_cvv && card_holder) {
        resolvedToken = await createCardToken(
          ACCESS_TOKEN,
          card_number,
          card_expiry,
          card_cvv,
          card_holder,
          cleanDoc
        );
      }
      if (!resolvedToken) {
        return new Response(
          JSON.stringify({ error: "Dados do cartão são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      mpPayload.token = resolvedToken;
      mpPayload.installments = installments;
      // Mercado Pago: if interest_free, set processing_mode to aggregator 
      // and sponsor_id to absorb interest
      if (interest_free_installments > 0 && interest_free_installments >= installments) {
        mpPayload.transaction_details = {
          ...(mpPayload.transaction_details as Record<string, unknown> || {}),
          total_paid_amount: amountDecimal,
        };
      }
    }

    console.log("Mercado Pago payload:", JSON.stringify(mpPayload));

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(mpPayload),
    });

    const contentType = mpResponse.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      const text = await mpResponse.text();
      console.error("Mercado Pago non-JSON response:", text.substring(0, 300));
      throw new Error("Mercado Pago retornou resposta inválida. Tente novamente.");
    }

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", JSON.stringify(mpData));
      return new Response(
        JSON.stringify({
          error: "Erro ao processar pagamento no Mercado Pago",
          details: mpData.message || mpData.cause?.[0]?.description || mpData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save to database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const orderData: Record<string, unknown> = {
      customer_name,
      customer_email,
      customer_phone,
      customer_document,
      product_id,
      product_name,
      amount_cents,
      payment_method,
      installments,
      provider: "mercadopago",
      status: mpData.status === "approved" ? "paid" : "pending",
      pagarme_order_id: String(mpData.id),
      pagarme_charge_id: String(mpData.id),
      payment_link_id: payment_link_id || null,
    };

    if (payment_method === "pix" && mpData.point_of_interaction?.transaction_data) {
      const txData = mpData.point_of_interaction.transaction_data;
      orderData.pix_qr_code = txData.qr_code;
      orderData.pix_qr_code_url = txData.qr_code_base64;
      orderData.pix_expires_at = mpData.date_of_expiration;
    }

    if (payment_method === "boleto" && mpData.transaction_details) {
      orderData.boleto_url = mpData.transaction_details.external_resource_url;
      orderData.boleto_barcode = mpData.barcode?.content;
      orderData.boleto_due_date = mpData.date_of_expiration;
    }

    await supabase.from("pagarme_orders").insert(orderData);

    if (mpData.status === "approved" && payment_link_id) {
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
      order_id: String(mpData.id),
      status: mpData.status,
      payment_method,
    };

    if (payment_method === "pix" && mpData.point_of_interaction?.transaction_data) {
      const txData = mpData.point_of_interaction.transaction_data;
      response.pix_qr_code = txData.qr_code;
      response.pix_qr_code_url = txData.qr_code_base64
        ? `data:image/png;base64,${txData.qr_code_base64}`
        : null;
      response.pix_expires_at = mpData.date_of_expiration;
    }

    if (payment_method === "boleto") {
      response.boleto_url = mpData.transaction_details?.external_resource_url;
      response.boleto_barcode = mpData.barcode?.content;
    }

    if (payment_method === "credit_card") {
      response.paid = mpData.status === "approved";
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("MP Checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
