import { createClient } from "@supabase/supabase-js";

const PUBLISHED_URL = "https://elevate-exec-direction.lovable.app";

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

    const {
      description,
      amount_cents,
      payment_method,
      recurrence,
      customer_name,
      customer_email,
      customer_document,
      company_id,
      recurring_charge_id,
      next_charge_date,
    } = await req.json();

    if (!description || !amount_cents || !recurrence || !customer_name || !customer_email) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Find or create customer
    const cleanDoc = customer_document?.replace(/\D/g, "") || "";
    let customerId: string | null = null;

    if (cleanDoc) {
      const existing = await asaasRequest(`/customers?cpfCnpj=${cleanDoc}`, "GET", ASAAS_API_KEY);
      if (existing.data?.length > 0) {
        customerId = existing.data[0].id;
      }
    }

    if (!customerId) {
      const customerPayload: Record<string, unknown> = {
        name: customer_name,
        email: customer_email,
      };
      if (cleanDoc) customerPayload.cpfCnpj = cleanDoc;
      const newCustomer = await asaasRequest("/customers", "POST", ASAAS_API_KEY, customerPayload);
      customerId = newCustomer.id;
    }

    console.log("Asaas customer:", customerId);

    // Step 2: Map recurrence to Asaas cycle
    let cycle = "MONTHLY";
    if (recurrence === "quarterly") cycle = "QUARTERLY";
    else if (recurrence === "yearly") cycle = "YEARLY";

    // Step 3: Map payment method
    let billingType = "PIX";
    if (payment_method === "credit_card") billingType = "CREDIT_CARD";
    else if (payment_method === "boleto") billingType = "BOLETO";

    // Step 4: Create subscription in Asaas
    const amountValue = amount_cents / 100;
    const nextDueDate = next_charge_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const subscriptionPayload: Record<string, unknown> = {
      customer: customerId,
      billingType,
      value: amountValue,
      cycle,
      nextDueDate,
      description,
    };

    const subscription = await asaasRequest("/subscriptions", "POST", ASAAS_API_KEY, subscriptionPayload);
    console.log("Asaas subscription created:", subscription.id);

    // Step 5: Create a local public payment link
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const encodedDesc = encodeURIComponent(description);
    let publicUrl = "";

    // Create a payment_links record for the subscription
    const { data: linkData } = await supabase
      .from("payment_links")
      .insert({
        description,
        amount_cents,
        payment_method: payment_method || "pix",
        installments: 1,
        url: "pending",
        company_id,
      })
      .select("id")
      .single();

    if (linkData) {
      publicUrl = `${PUBLISHED_URL}/#/checkout?link_id=${linkData.id}&amount=${amount_cents}&product=${encodedDesc}`;
      await supabase.from("payment_links").update({ url: publicUrl }).eq("id", linkData.id);
    }

    // Step 6: Update the recurring charge record
    if (recurring_charge_id) {
      await supabase
        .from("company_recurring_charges")
        .update({
          pagarme_plan_id: subscription.id,
          pagarme_link_id: linkData?.id || null,
          pagarme_link_url: publicUrl,
        } as any)
        .eq("id", recurring_charge_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscription.id,
        payment_link_url: publicUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Asaas subscription error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
