import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

async function asaasRequest(path: string, method: string, apiKey: string, body?: unknown) {
  console.log(`Asaas ${method} ${path}`);
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": apiKey,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error(`Asaas non-JSON (${res.status}):`, text.substring(0, 300));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {};
  }
  if (!res.ok) {
    console.error(`Asaas error (${res.status}):`, JSON.stringify(data));
    throw new Error(data.errors?.[0]?.description || data.message || JSON.stringify(data));
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY not configured");

    const body = await req.json();

    const {
      customer_name,
      customer_email,
      customer_phone,
      customer_document,
      product_name,
      amount_cents,
      payment_method,
      installments = 1,
      company_id,
      payment_link_id,
    } = body;

    if (!customer_name || !customer_email || !amount_cents || !payment_method) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Find or create customer in Asaas
    const cleanDoc = customer_document?.replace(/\D/g, "") || "";
    let customerId: string | null = null;

    if (cleanDoc) {
      // Try to find existing customer by CPF/CNPJ
      const existing = await asaasRequest(`/customers?cpfCnpj=${cleanDoc}`, "GET", ASAAS_API_KEY);
      if (existing.data?.length > 0) {
        customerId = existing.data[0].id;
        console.log("Found existing Asaas customer:", customerId);
      }
    }

    if (!customerId) {
      // Create new customer
      const customerPayload: Record<string, unknown> = {
        name: customer_name,
        email: customer_email,
      };
      if (cleanDoc) {
        customerPayload.cpfCnpj = cleanDoc;
      }
      if (customer_phone) {
        customerPayload.mobilePhone = customer_phone.replace(/\D/g, "");
      }
      const newCustomer = await asaasRequest("/customers", "POST", ASAAS_API_KEY, customerPayload);
      customerId = newCustomer.id;
      console.log("Created Asaas customer:", customerId);
    }

    // Step 2: Map payment method
    let billingType = "PIX";
    if (payment_method === "credit_card") billingType = "CREDIT_CARD";
    else if (payment_method === "boleto") billingType = "BOLETO";

    // Step 3: Create payment (charge)
    const amountValue = amount_cents / 100;
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const paymentPayload: Record<string, unknown> = {
      customer: customerId,
      billingType,
      value: amountValue,
      dueDate,
      description: product_name || "Cobrança avulsa",
      notifications: { disabled: true },
    };

    if (billingType === "CREDIT_CARD" && installments > 1) {
      paymentPayload.installmentCount = installments;
      paymentPayload.installmentValue = Math.round((amountValue / installments) * 100) / 100;
    }

    const payment = await asaasRequest("/payments", "POST", ASAAS_API_KEY, paymentPayload);
    console.log("Asaas payment created:", payment.id, "status:", payment.status);

    // Step 4: Get PIX QR Code if applicable
    let pixData: any = null;
    if (billingType === "PIX" && payment.id) {
      try {
        pixData = await asaasRequest(`/payments/${payment.id}/pixQrCode`, "GET", ASAAS_API_KEY);
      } catch (e) {
        console.error("Error getting PIX QR:", e);
      }
    }

    // Step 5: Save to database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const orderData: Record<string, unknown> = {
      customer_name,
      customer_email,
      customer_phone,
      customer_document,
      product_id: `company-${company_id || "direct"}`,
      product_name: product_name || "Cobrança avulsa",
      amount_cents,
      payment_method,
      installments,
      status: payment.status === "CONFIRMED" || payment.status === "RECEIVED" ? "paid" : "pending",
      pagarme_order_id: payment.id, // Reusing column for Asaas payment ID
      pagarme_charge_id: payment.id,
      payment_link_id: payment_link_id || null,
    };

    if (pixData) {
      orderData.pix_qr_code = pixData.payload;
      orderData.pix_qr_code_url = pixData.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : null;
    }

    if (billingType === "BOLETO") {
      orderData.boleto_url = payment.bankSlipUrl;
    }

    await supabase.from("pagarme_orders").insert(orderData);

    // If payment is paid and linked to invoice, mark invoice as paid
    if ((payment.status === "CONFIRMED" || payment.status === "RECEIVED") && payment_link_id) {
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
      order_id: payment.id,
      status: payment.status === "CONFIRMED" || payment.status === "RECEIVED" ? "paid" : "pending",
      payment_method,
      invoice_url: payment.invoiceUrl,
    };

    if (billingType === "PIX" && pixData) {
      response.pix_qr_code = pixData.payload;
      response.pix_qr_code_url = pixData.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : null;
    }

    if (billingType === "BOLETO") {
      response.boleto_url = payment.bankSlipUrl;
    }

    if (billingType === "CREDIT_CARD") {
      response.paid = payment.status === "CONFIRMED";
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Asaas checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
