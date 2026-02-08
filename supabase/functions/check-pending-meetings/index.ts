import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all unfinalized meetings that are in the past
    const { data: pendingMeetings, error: meetingsError } = await supabase
      .from("onboarding_meeting_notes")
      .select(`
        id,
        meeting_title,
        meeting_date,
        subject,
        staff_id,
        project_id,
        onboarding_projects!inner (
          id,
          product_name,
          onboarding_company_id,
          onboarding_companies (
            name,
            cs_id,
            consultant_id
          )
        )
      `)
      .eq("is_finalized", false)
      .lt("meeting_date", new Date().toISOString());

    if (meetingsError) {
      throw meetingsError;
    }

    console.log(`Found ${pendingMeetings?.length || 0} pending meetings`);

    const notificationsToCreate: any[] = [];
    const processedMeetings = new Set<string>();

    for (const meeting of pendingMeetings || []) {
      // Skip if we already processed this meeting in this run
      if (processedMeetings.has(meeting.id)) continue;
      processedMeetings.add(meeting.id);

      const project = meeting.onboarding_projects as any;
      const company = project?.onboarding_companies;
      const companyName = company?.name || project?.product_name || "Projeto";

      // Determine who to notify: the staff who created the meeting, or the CS/Consultant
      const staffToNotify = new Set<string>();
      
      if (meeting.staff_id) {
        staffToNotify.add(meeting.staff_id);
      }
      if (company?.cs_id) {
        staffToNotify.add(company.cs_id);
      }
      if (company?.consultant_id) {
        staffToNotify.add(company.consultant_id);
      }

      // Check if notifications already exist for this meeting (avoid duplicates)
      const { data: existingNotifications } = await supabase
        .from("onboarding_notifications")
        .select("id, staff_id")
        .eq("reference_id", meeting.id)
        .eq("reference_type", "meeting")
        .eq("type", "pending_meeting");

      const alreadyNotified = new Set(existingNotifications?.map(n => n.staff_id) || []);

      for (const staffId of staffToNotify) {
        if (alreadyNotified.has(staffId)) continue;

        notificationsToCreate.push({
          staff_id: staffId,
          project_id: meeting.project_id,
          type: "pending_meeting",
          title: "⏰ Reunião pendente de finalização",
          message: `A reunião "${meeting.subject}" com ${companyName} ainda não foi finalizada. Registre as anotações e participantes.`,
          reference_id: meeting.id,
          reference_type: "meeting",
        });
      }
    }

    if (notificationsToCreate.length > 0) {
      const { error: notifyError } = await supabase
        .from("onboarding_notifications")
        .insert(notificationsToCreate);

      if (notifyError) {
        console.error("Error creating notifications:", notifyError);
      } else {
        console.log(`Created ${notificationsToCreate.length} notifications`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pendingMeetings: pendingMeetings?.length || 0,
        notificationsCreated: notificationsToCreate.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error checking pending meetings:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
