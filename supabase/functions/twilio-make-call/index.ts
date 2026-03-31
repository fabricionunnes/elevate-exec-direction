import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate env
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!TWILIO_PHONE_NUMBER) throw new Error("TWILIO_PHONE_NUMBER is not configured");

    const { lead_phone, staff_phone, lead_id, lead_name } = await req.json();

    if (!lead_phone || !staff_phone) {
      return new Response(
        JSON.stringify({ error: "lead_phone and staff_phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the TwiML URL that Twilio will fetch when the staff answers
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const twimlUrl = `${supabaseUrl}/functions/v1/twilio-twiml?lead_phone=${encodeURIComponent(lead_phone)}`;

    // Initiate call: Twilio calls the staff member first
    const response = await fetch(`${GATEWAY_URL}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: staff_phone,
        From: TWILIO_PHONE_NUMBER,
        Url: twimlUrl,
        StatusCallback: `${supabaseUrl}/functions/v1/twilio-call-status`,
        StatusCallbackEvent: "initiated ringing answered completed",
        StatusCallbackMethod: "POST",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Twilio API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    // Log the call in crm_lead_activities
    if (lead_id) {
      const userId = claims.claims.sub;
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (staffData) {
        await supabase.from("crm_lead_activities").insert({
          lead_id,
          type: "call",
          title: `Ligação para ${lead_name || lead_phone}`,
          notes: `Call SID: ${data.sid}`,
          performed_by_staff_id: staffData.id,
        });

        // Update lead last_activity_at
        await supabase
          .from("crm_leads")
          .update({ last_activity_at: new Date().toISOString() })
          .eq("id", lead_id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, call_sid: data.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error making call:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
