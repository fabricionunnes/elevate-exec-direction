import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubmitPayload {
  action: "submit";
  respondentName: string;
  companyName: string;
  subjects: string[];
  description?: string | null;
}

type Payload = SubmitPayload;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json()) as Payload;

    if (!body || body.action !== "submit") {
      console.log("hotseat-public: invalid action", { body });
      return new Response(JSON.stringify({ error: "invalid_action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required fields
    if (!body.respondentName || !body.respondentName.trim()) {
      return new Response(JSON.stringify({ error: "missing_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.companyName || !body.companyName.trim()) {
      return new Response(JSON.stringify({ error: "missing_company" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.subjects || !Array.isArray(body.subjects) || body.subjects.length === 0) {
      return new Response(JSON.stringify({ error: "missing_subjects" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert the hotseat response
    const { data: hotseatResponse, error: insertError } = await supabase
      .from("hotseat_responses")
      .insert({
        respondent_name: body.respondentName.trim(),
        company_name: body.companyName.trim(),
        subjects: body.subjects,
        description: body.description?.trim() || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("hotseat-public: insert error", insertError);
      return new Response(JSON.stringify({ error: "insert_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("hotseat-public: response created", { id: hotseatResponse.id });

    return new Response(JSON.stringify({ ok: true, id: hotseatResponse.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("hotseat-public error:", err);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
