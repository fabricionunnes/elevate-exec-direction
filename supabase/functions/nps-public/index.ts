import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SubmitPayload = {
  action: "submit";
  projectId: string;
  score: number;
  feedback?: string | null;
  whatCanImprove?: string | null;
  wouldRecommendWhy?: string | null;
  respondentName?: string | null;
  referrals?: Array<{ name: string; phone: string }>;
};

type Payload = SubmitPayload;

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

    const body = (await req.json()) as Payload;

    if (!body || body.action !== "submit") {
      return new Response(JSON.stringify({ error: "invalid_action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.projectId) {
      return new Response(JSON.stringify({ error: "missing_project" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Number.isFinite(body.score) || body.score < 0 || body.score > 10) {
      return new Response(JSON.stringify({ error: "invalid_score" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project, error: projectError } = await supabase
      .from("onboarding_projects")
      .select("id, onboarding_company_id")
      .eq("id", body.projectId)
      .maybeSingle();

    if (projectError || !project) {
      console.log("NPS submit: project not found", { projectId: body.projectId, projectError });
      return new Response(JSON.stringify({ error: "project_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: npsResponse, error: npsError } = await supabase
      .from("onboarding_nps_responses")
      .insert({
        project_id: body.projectId,
        score: body.score,
        feedback: body.feedback ?? null,
        what_can_improve: body.whatCanImprove ?? null,
        would_recommend_why: body.wouldRecommendWhy ?? null,
        respondent_name: body.respondentName ?? null,
        respondent_email: null,
      })
      .select("id")
      .single();

    if (npsError || !npsResponse) {
      console.log("NPS submit: insert failed", { npsError });
      return new Response(JSON.stringify({ error: "insert_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const referrals = Array.isArray(body.referrals) ? body.referrals : [];
    const validReferrals = referrals
      .map((r) => ({ name: (r?.name ?? "").trim(), phone: (r?.phone ?? "").trim() }))
      .filter((r) => r.name && r.phone);

    if (body.score >= 8 && project.onboarding_company_id && validReferrals.length > 0) {
      const { error: referralError } = await supabase.from("client_referrals").insert(
        validReferrals.map((r) => ({
          referrer_company_id: project.onboarding_company_id,
          referrer_project_id: body.projectId,
          referrer_name: body.respondentName ?? null,
          referred_name: r.name,
          referred_phone: r.phone,
          source: "nps",
          nps_response_id: npsResponse.id,
        }))
      );

      if (referralError) {
        // Don't fail the whole submission for referral errors.
        console.log("NPS submit: referral insert failed", { referralError });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("nps-public error:", err);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
