import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FABRICIO_STAFF_ID = "6e007dbe-bfcb-4252-a6fc-80769a4e9b5e";
const YASMIM_STAFF_ID = "adcd56ab-3e0b-418b-9f5c-b7bdfa07952a";
const NOTIFY_STAFF_IDS = [FABRICIO_STAFF_ID, YASMIM_STAFF_ID];

// Notify 30 days before, 15 days before, 7 days before, and on the day
const NOTIFY_DAYS_BEFORE = [30, 15, 7, 0];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all employee contracts with start_date and duration_months
    const { data: contracts, error } = await supabase
      .from("employee_contracts")
      .select("id, staff_name, staff_role, start_date, duration_months")
      .not("start_date", "is", null)
      .not("duration_months", "is", null);

    if (error) {
      console.error("Error fetching contracts:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let notificationsSent = 0;

    for (const contract of contracts || []) {
      const startDate = new Date(contract.start_date);
      const durationMonths = contract.duration_months || 3;

      // Calculate expiry date
      const expiryDate = new Date(startDate);
      expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
      expiryDate.setHours(0, 0, 0, 0);

      // Calculate days until expiry
      const diffMs = expiryDate.getTime() - today.getTime();
      const daysUntilExpiry = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Check if we should notify today
      if (!NOTIFY_DAYS_BEFORE.includes(daysUntilExpiry)) continue;

      // Build notification message
      let title: string;
      let message: string;

      if (daysUntilExpiry === 0) {
        title = `🔴 Contrato de ${contract.staff_name} vence HOJE`;
        message = `O contrato de ${contract.staff_name} (${contract.staff_role}) vence hoje e precisa ser renovado.`;
      } else if (daysUntilExpiry <= 7) {
        title = `🟠 Contrato de ${contract.staff_name} vence em ${daysUntilExpiry} dias`;
        message = `O contrato de ${contract.staff_name} (${contract.staff_role}) vence em ${daysUntilExpiry} dias. Providencie a renovação.`;
      } else {
        title = `📋 Contrato de ${contract.staff_name} vence em ${daysUntilExpiry} dias`;
        message = `O contrato de ${contract.staff_name} (${contract.staff_role}) vencerá em ${daysUntilExpiry} dias (${expiryDate.toLocaleDateString("pt-BR")}). Planeje a renovação.`;
      }

      // Check if notification was already sent today for this contract
      const todayStr = today.toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("onboarding_notifications")
        .select("id")
        .eq("reference_id", contract.id)
        .eq("reference_type", "employee_contract_renewal")
        .gte("created_at", todayStr + "T00:00:00")
        .lte("created_at", todayStr + "T23:59:59")
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Send notification to both staff members
      const notifications = NOTIFY_STAFF_IDS.map((staffId) => ({
        staff_id: staffId,
        type: "contract",
        title,
        message,
        reference_id: contract.id,
        reference_type: "employee_contract_renewal",
      }));

      const { error: insertError } = await supabase
        .from("onboarding_notifications")
        .insert(notifications);

      if (insertError) {
        console.error(`Error sending notification for ${contract.staff_name}:`, insertError);
      } else {
        notificationsSent += notifications.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        contractsChecked: contracts?.length || 0,
        notificationsSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
