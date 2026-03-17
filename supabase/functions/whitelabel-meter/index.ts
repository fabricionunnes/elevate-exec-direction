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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all active/trial tenants
    const { data: tenants, error: tenantErr } = await supabase
      .from("whitelabel_tenants")
      .select("id, name, max_active_projects, status")
      .in("status", ["active", "trial"]);

    if (tenantErr) throw tenantErr;

    const results = [];

    for (const tenant of tenants || []) {
      // Count active projects for this tenant
      const { count, error: countErr } = await supabase
        .from("onboarding_projects")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("status", "active");

      if (countErr) {
        results.push({ tenant_id: tenant.id, error: countErr.message });
        continue;
      }

      const activeCount = count || 0;

      // Upsert subscription record
      const { error: subErr } = await supabase
        .from("whitelabel_subscriptions")
        .upsert(
          {
            tenant_id: tenant.id,
            active_projects_count: activeCount,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" }
        );

      // Suspend tenant if over limit and not already suspended
      if (activeCount > tenant.max_active_projects && tenant.status === "active") {
        // Just log, don't auto-suspend (admin decision)
        console.warn(
          `Tenant ${tenant.name} (${tenant.id}) over limit: ${activeCount}/${tenant.max_active_projects}`
        );
      }

      results.push({
        tenant_id: tenant.id,
        name: tenant.name,
        active_projects: activeCount,
        max_projects: tenant.max_active_projects,
        over_limit: activeCount > tenant.max_active_projects,
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
