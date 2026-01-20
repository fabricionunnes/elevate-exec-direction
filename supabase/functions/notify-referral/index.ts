import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyPayload {
  referrerName: string | null;
  referredName: string;
  referredPhone: string;
  companyId: string;
  projectId: string;
  source: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json()) as NotifyPayload;

    console.log("Notify referral received:", body);

    if (!body.companyId || !body.referredName) {
      return new Response(JSON.stringify({ error: "missing_required_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company name
    const { data: company } = await supabase
      .from("onboarding_companies")
      .select("name")
      .eq("id", body.companyId)
      .maybeSingle();

    const companyName = company?.name || "Empresa desconhecida";

    // Get all active admin and CS staff members
    const { data: staffMembers, error: staffError } = await supabase
      .from("onboarding_staff")
      .select("id, name, role")
      .in("role", ["admin", "cs"])
      .eq("is_active", true);

    if (staffError) {
      console.error("Error fetching staff members:", staffError);
      return new Response(JSON.stringify({ error: "failed_to_fetch_staff" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!staffMembers || staffMembers.length === 0) {
      console.log("No admin or CS staff found to notify");
      return new Response(JSON.stringify({ ok: true, notified: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${staffMembers.length} staff members to notify`);

    // Create notification for each admin and CS
    const notifications = staffMembers.map((staff) => ({
      staff_id: staff.id,
      project_id: body.projectId,
      type: "referral",
      title: "🎉 Nova Indicação Recebida!",
      message: `${body.referrerName || "Um cliente"} de ${companyName} indicou ${body.referredName} (${body.referredPhone}). Fonte: ${body.source === "nps" ? "Pesquisa NPS" : "Portal do Cliente"}`,
      reference_type: "referral",
      is_read: false,
    }));

    const { error: notifyError } = await supabase
      .from("onboarding_notifications")
      .insert(notifications);

    if (notifyError) {
      console.error("Error creating notifications:", notifyError);
      return new Response(JSON.stringify({ error: "failed_to_create_notifications" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Successfully notified ${staffMembers.length} staff members about referral`);

    return new Response(JSON.stringify({ ok: true, notified: staffMembers.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-referral error:", err);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
