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

    const { plan_id, company_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cancelledPlans: string[] = [];

    // Case 1: Cancel a specific plan
    if (plan_id) {
      try {
        await pagarmeRequest(`/plans/${plan_id}`, "DELETE", PAGARME_API_KEY);
        cancelledPlans.push(plan_id);
        console.log("Plan cancelled:", plan_id);
      } catch (err: any) {
        console.error("Error cancelling plan:", plan_id, err.message);
        // Plan might already be cancelled, continue
      }
    }

    // Case 2: Cancel ALL active plans for a company
    if (company_id) {
      const { data: charges, error } = await supabase
        .from("company_recurring_charges")
        .select("id, pagarme_plan_id")
        .eq("company_id", company_id)
        .eq("is_active", true)
        .not("pagarme_plan_id", "is", null);

      if (error) {
        console.error("Error fetching charges:", error);
      } else if (charges && charges.length > 0) {
        for (const charge of charges) {
          try {
            await pagarmeRequest(`/plans/${charge.pagarme_plan_id}`, "DELETE", PAGARME_API_KEY);
            cancelledPlans.push(charge.pagarme_plan_id);
            console.log("Plan cancelled:", charge.pagarme_plan_id);
          } catch (err: any) {
            console.error("Error cancelling plan:", charge.pagarme_plan_id, err.message);
          }

          // Mark as inactive locally
          await supabase
            .from("company_recurring_charges")
            .update({ is_active: false })
            .eq("id", charge.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, cancelled_plans: cancelledPlans }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Cancel subscription error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
