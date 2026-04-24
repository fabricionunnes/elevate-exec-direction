// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const surveyId = url.searchParams.get("survey_id");
      if (!surveyId) {
        return new Response(JSON.stringify({ error: "survey_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase
        .from("profile_climate_surveys")
        .select("id, title, type, status, questions")
        .eq("id", surveyId)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ survey: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { survey_id, answers, enps_score, is_anonymous, respondent_name, respondent_email } = body || {};
      if (!survey_id || !answers) {
        return new Response(JSON.stringify({ error: "survey_id and answers required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: survey, error: sErr } = await supabase
        .from("profile_climate_surveys")
        .select("id, tenant_id, status")
        .eq("id", survey_id)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!survey) {
        return new Response(JSON.stringify({ error: "Survey not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (survey.status === "closed") {
        return new Response(JSON.stringify({ error: "Survey closed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const finalAnswers = is_anonymous
        ? answers
        : { ...answers, _respondent: { name: respondent_name || null, email: respondent_email || null } };

      const payload: any = {
        survey_id,
        tenant_id: survey.tenant_id,
        answers: finalAnswers,
        is_anonymous: !!is_anonymous,
      };
      if (typeof enps_score === "number" && !isNaN(enps_score)) payload.enps_score = enps_score;

      const { error: iErr } = await supabase.from("profile_climate_responses").insert(payload);
      if (iErr) throw iErr;

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[profile-climate-public]", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
