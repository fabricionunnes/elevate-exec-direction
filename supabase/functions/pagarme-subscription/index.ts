import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGARME_BASE = "https://api.pagar.me/core/v5";

async function pagarmeRequest(path: string, method: string, apiKey: string, body?: unknown) {
  console.log(`Pagar.me ${method} ${path}`);
  const res = await fetch(`${PAGARME_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(apiKey + ":")}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error(`Pagar.me non-JSON (${res.status}):`, text.substring(0, 300));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {};
  }
  if (!res.ok) {
    console.error(`Pagar.me error (${res.status}):`, JSON.stringify(data));
    throw new Error(data.message || JSON.stringify(data));
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAGARME_API_KEY = Deno.env.get("PAGARME_API_KEY");
    if (!PAGARME_API_KEY) throw new Error("PAGARME_API_KEY not configured");

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
    } = await req.json();

    if (!description || !amount_cents || !recurrence) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map recurrence to Pagar.me interval
    let interval = "month";
    let interval_count = 1;
    if (recurrence === "quarterly") {
      interval = "month";
      interval_count = 3;
    } else if (recurrence === "yearly") {
      interval = "year";
      interval_count = 1;
    }

    // Pagar.me Plans only accept: credit_card, debit_card, cash, boleto
    const planPaymentMethod = payment_method === "credit_card" ? "credit_card" : "boleto";

    // Step 1: Create Plan on Pagar.me
    const plan = await pagarmeRequest("/plans", "POST", PAGARME_API_KEY, {
      name: description,
      payment_methods: [planPaymentMethod],
      interval,
      interval_count,
      billing_type: "prepaid",
      installments: [1],
      items: [
        {
          name: description,
          quantity: 1,
          pricing_scheme: {
            price: amount_cents,
          },
        },
      ],
    });

    console.log("Plan created:", plan.id);

    // Step 2: Create a local payment link for checkout (same system as CompanyPaymentLinks)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const PUBLISHED_URL = "https://elevate-exec-direction.lovable.app";

    const { data: linkData, error: linkError } = await supabase
      .from("payment_links")
      .insert({
        description: `${description} (Recorrência)`,
        amount_cents,
        payment_method,
        installments: 1,
        url: `${PUBLISHED_URL}/checkout`,
        company_id,
      })
      .select()
      .single();

    if (linkError) {
      console.error("Link insert error:", linkError);
      throw new Error("Erro ao criar link de pagamento local");
    }

    const fullUrl = `${PUBLISHED_URL}/checkout?link_id=${linkData.id}`;
    await supabase.from("payment_links").update({ url: fullUrl }).eq("id", linkData.id);

    console.log("Local payment link created:", linkData.id);

    // Step 3: Update the recurring charge record
    if (recurring_charge_id) {
      await supabase
        .from("company_recurring_charges")
        .update({
          pagarme_plan_id: plan.id,
          pagarme_link_id: linkData.id,
          pagarme_link_url: fullUrl,
        })
        .eq("id", recurring_charge_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan_id: plan.id,
        link_id: linkData.id,
        link_url: fullUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Subscription error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
