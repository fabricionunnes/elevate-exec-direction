import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GetPayload = {
  action: "get";
  token: string;
};

type SubmitPayload = {
  action: "submit";
  token: string;
  score: number;
  feedback?: string | null;
  respondentName?: string | null;
};

type Payload = GetPayload | SubmitPayload;

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

    if (!body || !body.token) {
      return new Response(JSON.stringify({ error: "missing_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "get") {
      const { data: survey, error: surveyError } = await supabase
        .from("csat_surveys")
        .select("id, project_id, meeting_id, hotseat_response_id, status")
        .eq("access_token", body.token)
        .maybeSingle();

      if (surveyError || !survey) {
        console.log("CSAT get: survey not found", { token: body.token, surveyError });
        return new Response(JSON.stringify({ error: "survey_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (survey.status === "responded") {
        return new Response(JSON.stringify({ alreadyResponded: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle Hotseat CSAT
      if (survey.hotseat_response_id) {
        console.log("CSAT get: hotseat survey", { hotseatId: survey.hotseat_response_id });
        
        const { data: hotseat, error: hotseatError } = await supabase
          .from("hotseat_responses")
          .select("respondent_name, company_name, created_at, linked_project_id")
          .eq("id", survey.hotseat_response_id)
          .maybeSingle();

        if (hotseatError || !hotseat) {
          console.log("CSAT get: hotseat not found", { hotseatId: survey.hotseat_response_id, hotseatError });
          return new Response(JSON.stringify({ error: "hotseat_not_found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let companyName = hotseat.company_name;
        
        // Try to get project/company info if linked
        if (hotseat.linked_project_id) {
          const { data: project } = await supabase
            .from("onboarding_projects")
            .select("product_name, onboarding_company:onboarding_companies(name)")
            .eq("id", hotseat.linked_project_id)
            .maybeSingle();
          
          const company = (project as any)?.onboarding_company;
          if (company?.name) {
            companyName = company.name;
          }
        }

        return new Response(
          JSON.stringify({
            surveyId: survey.id,
            hotseatResponseId: survey.hotseat_response_id,
            projectId: survey.project_id,
            isHotseat: true,
            hotseatInfo: {
              respondent_name: hotseat.respondent_name,
              company_name: companyName,
              created_at: hotseat.created_at,
            },
            project: {
              product_name: "Hotseat com Fabrício Nunnes",
              company_name: companyName,
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Handle Meeting CSAT (original logic)
      const { data: meeting, error: meetingError } = await supabase
        .from("onboarding_meeting_notes")
        .select("meeting_title, meeting_date, project_id")
        .eq("id", survey.meeting_id)
        .maybeSingle();

      if (meetingError || !meeting) {
        console.log("CSAT get: meeting not found", { meetingId: survey.meeting_id, meetingError });
        return new Response(JSON.stringify({ error: "meeting_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: project, error: projectError } = await supabase
        .from("onboarding_projects")
        .select("product_name, onboarding_company:onboarding_companies(name)")
        .eq("id", meeting.project_id)
        .maybeSingle();

      if (projectError || !project) {
        console.log("CSAT get: project not found", { projectId: meeting.project_id, projectError });
        return new Response(JSON.stringify({ error: "project_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          surveyId: survey.id,
          meetingId: survey.meeting_id,
          projectId: survey.project_id,
          meetingTitle: (meeting as any).meeting_title ?? null,
          meetingDate: (meeting as any).meeting_date ?? null,
          project: {
            product_name: (project as any).product_name ?? "",
            company_name: (project as any).onboarding_company?.name ?? null,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (body.action === "submit") {
      if (!Number.isFinite(body.score) || body.score < 1 || body.score > 5) {
        return new Response(JSON.stringify({ error: "invalid_score" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: survey, error: surveyError } = await supabase
        .from("csat_surveys")
        .select("id, project_id, meeting_id, hotseat_response_id, status")
        .eq("access_token", body.token)
        .maybeSingle();

      if (surveyError || !survey) {
        return new Response(JSON.stringify({ error: "survey_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (survey.status === "responded") {
        return new Response(JSON.stringify({ error: "already_responded" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Defensive: ensure no response exists for this survey
      const { data: existingResponse } = await supabase
        .from("csat_responses")
        .select("id")
        .eq("survey_id", survey.id)
        .maybeSingle();

      if (existingResponse) {
        await supabase.from("csat_surveys").update({ status: "responded" }).eq("id", survey.id);
        return new Response(JSON.stringify({ error: "already_responded" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert response - handle both meeting and hotseat cases
      const insertData: any = {
        survey_id: survey.id,
        project_id: survey.project_id,
        score: body.score,
        feedback: body.feedback ?? null,
        respondent_name: body.respondentName ?? null,
      };

      if (survey.meeting_id) {
        insertData.meeting_id = survey.meeting_id;
      }
      if (survey.hotseat_response_id) {
        insertData.hotseat_response_id = survey.hotseat_response_id;
      }

      const { error: insertError } = await supabase.from("csat_responses").insert(insertData);

      if (insertError) {
        console.log("CSAT submit: insert failed", { insertError });
        return new Response(JSON.stringify({ error: "insert_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("csat_surveys")
        .update({ status: "responded" })
        .eq("id", survey.id);

      if (updateError) {
        console.log("CSAT submit: status update failed", { updateError });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "invalid_action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("csat-public error:", err);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
