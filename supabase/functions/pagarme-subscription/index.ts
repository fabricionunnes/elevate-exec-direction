import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAGARME_BASE = "https://api.pagar.me/core/v5";

async function pagarmeRequest(path: string, method: string, apiKey: string, body?: unknown) {
  const res = await fetch(`${PAGARME_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(apiKey + ":")}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Pagar.me ${method} ${path} error:`, JSON.stringify(data));
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

    if (!description || !amount_cents || !payment_method || !recurrence) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map recurrence to Pagar.me interval
    let interval = "month";
    let interval_count = 1;
    if (recurrence === "monthly") {
      interval = "month";
      interval_count = 1;
    } else if (recurrence === "quarterly") {
      interval = "month";
      interval_count = 3;
    } else if (recurrence === "yearly") {
      interval = "year";
      interval_count = 1;
    }

    // Map payment method
    const paymentMethods: string[] = [];
    if (payment_method === "credit_card") paymentMethods.push("credit_card");
    else if (payment_method === "boleto") paymentMethods.push("boleto");
    else if (payment_method === "pix") paymentMethods.push("pix");
    // fallback
    if (paymentMethods.length === 0) paymentMethods.push("credit_card");

    // Step 1: Create Plan
    const plan = await pagarmeRequest("/plans", "POST", PAGARME_API_KEY, {
      name: description,
      payment_methods: paymentMethods,
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

    // Step 2: Create Payment Link with type "subscription"
    const paymentSettings: Record<string, unknown> = {
      accepted_payment_methods: paymentMethods,
    };

    const customerSettings: Record<string, unknown> = {};
    if (customer_name) customerSettings.name = customer_name;
    if (customer_email) customerSettings.email = customer_email;
    if (customer_document) customerSettings.document = customer_document?.replace(/\D/g, "");

    const linkPayload: Record<string, unknown> = {
      name: description,
      type: "subscription",
      payment_settings: paymentSettings,
      cart_settings: {
        items: [
          {
            amount: amount_cents,
            description: description,
            quantity: 1,
            name: description,
          },
        ],
      },
      subscription_settings: {
        plan_id: plan.id,
      },
    };

    if (Object.keys(customerSettings).length > 0) {
      linkPayload.customer_settings = customerSettings;
    }

    const link = await pagarmeRequest("/paymentlinks", "POST", PAGARME_API_KEY, linkPayload);

    console.log("Payment link created:", link.id, link.url);

    // Step 3: Update the recurring charge record with Pagar.me IDs
    if (recurring_charge_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await supabase
        .from("company_recurring_charges")
        .update({
          pagarme_plan_id: plan.id,
          pagarme_link_id: link.id,
          pagarme_link_url: link.url,
        })
        .eq("id", recurring_charge_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan_id: plan.id,
        link_id: link.id,
        link_url: link.url,
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
