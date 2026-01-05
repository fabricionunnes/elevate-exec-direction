import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Checking for notice periods ending today...");

    // Find all projects in "notice_period" status where notice_end_date is today
    const today = new Date().toISOString().split('T')[0];
    
    const { data: projects, error: projectsError } = await supabase
      .from("onboarding_projects")
      .select(`
        id,
        product_name,
        onboarding_company_id,
        onboarding_company:onboarding_companies(name, cs_id, consultant_id)
      `)
      .eq("status", "notice_period")
      .eq("notice_end_date", today);

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      throw projectsError;
    }

    console.log(`Found ${projects?.length || 0} projects with notice ending today`);

    const notifications = [];

    for (const project of projects || []) {
      const companyData = project.onboarding_company;
      const company = Array.isArray(companyData) ? companyData[0] : companyData;
      const companyName = company?.name || project.product_name;
      const csId = company?.cs_id;
      const consultantId = company?.consultant_id;

      const notificationTitle = `⏰ Aviso expirando hoje: ${companyName}`;
      const notificationMessage = `O período de aviso do projeto ${companyName} termina hoje. Defina se o cliente será reativado ou encerrado.`;

      // Notify CS if exists
      if (csId) {
        notifications.push({
          staff_id: csId,
          project_id: project.id,
          type: "notice_expiring",
          title: notificationTitle,
          message: notificationMessage,
          reference_id: project.id,
          reference_type: "project",
        });
      }

      // Notify Consultant if exists and different from CS
      if (consultantId && consultantId !== csId) {
        notifications.push({
          staff_id: consultantId,
          project_id: project.id,
          type: "notice_expiring",
          title: notificationTitle,
          message: notificationMessage,
          reference_id: project.id,
          reference_type: "project",
        });
      }
    }

    // Insert all notifications
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from("onboarding_notifications")
        .insert(notifications);

      if (insertError) {
        console.error("Error inserting notifications:", insertError);
        throw insertError;
      }

      console.log(`Created ${notifications.length} notifications`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        projectsChecked: projects?.length || 0,
        notificationsCreated: notifications.length 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in check-notice-periods:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
