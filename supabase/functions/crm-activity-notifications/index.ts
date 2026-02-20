import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find pending activities that are due and not yet notified
    const now = new Date().toISOString();
    const { data: dueActivities, error: fetchError } = await supabase
      .from("crm_activities")
      .select(`
        id, title, type, scheduled_at, lead_id, responsible_staff_id,
        lead:crm_leads!crm_activities_lead_id_fkey(name)
      `)
      .eq("status", "pending")
      .is("notified_at", null)
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", now);

    if (fetchError) throw fetchError;

    if (!dueActivities || dueActivities.length === 0) {
      return new Response(JSON.stringify({ message: "No due activities", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let notifiedCount = 0;

    for (const activity of dueActivities) {
      if (!activity.responsible_staff_id) continue;

      const leadName = (activity.lead as any)?.name || "Lead";
      const typeLabel: Record<string, string> = {
        call: "Ligação",
        whatsapp: "WhatsApp",
        email: "E-mail",
        meeting: "Reunião",
        followup: "Follow-up",
        proposal: "Proposta",
        other: "Atividade",
      };

      const label = typeLabel[activity.type] || "Atividade";

      // Create notification
      const { error: notifError } = await supabase
        .from("onboarding_notifications")
        .insert({
          staff_id: activity.responsible_staff_id,
          type: "crm_activity_due",
          title: `📋 ${label} pendente: ${activity.title}`,
          message: `Atividade agendada para ${leadName} está no horário. Verifique e conclua.`,
          reference_id: activity.lead_id,
          reference_type: "crm_lead",
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
        continue;
      }

      // Mark as notified
      await supabase
        .from("crm_activities")
        .update({ notified_at: now })
        .eq("id", activity.id);

      notifiedCount++;
    }

    return new Response(
      JSON.stringify({ message: "Notifications sent", count: notifiedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
