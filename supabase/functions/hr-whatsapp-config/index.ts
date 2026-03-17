import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RequestBody = {
  action?: "get" | "save";
  projectId?: string;
  instanceId?: string | null;
  notifyOnStageChange?: boolean;
  notifyPhone?: string | null;
  notifyGroupJid?: string | null;
  notifyGroupName?: string | null;
  messageTemplate?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Missing required environment variables", {
        hasUrl: Boolean(supabaseUrl),
        hasAnonKey: Boolean(anonKey),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });

      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requester = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await requester.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({} as RequestBody));
    const action = body.action ?? "get";
    const projectId = body.projectId;

    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [{ data: staffMember }, { data: onboardingUser }] = await Promise.all([
      admin
        .from("onboarding_staff")
        .select("id, role")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .maybeSingle(),
      admin
        .from("onboarding_users")
        .select("id, role")
        .eq("user_id", userData.user.id)
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);

    const canAccess = Boolean(staffMember?.id || (onboardingUser?.id && onboardingUser.role !== "client"));

    if (!canAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get") {
      const { data: config, error } = await admin
        .from("hr_whatsapp_config")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching hr_whatsapp_config:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ config }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      const payload = {
        project_id: projectId,
        instance_id: body.instanceId ?? null,
        notify_on_stage_change: Boolean(body.notifyOnStageChange),
        notify_phone: body.notifyPhone?.trim() || null,
        notify_group_jid: body.notifyGroupJid?.trim() || null,
        notify_group_name: body.notifyGroupName?.trim() || null,
        message_template: body.messageTemplate?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data: config, error } = await admin
        .from("hr_whatsapp_config")
        .upsert(payload, { onConflict: "project_id" })
        .select("*")
        .single();

      if (error) {
        console.error("Error saving hr_whatsapp_config:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ config }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error in hr-whatsapp-config:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
