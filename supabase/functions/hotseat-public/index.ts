import { createClient } from "@supabase/supabase-js";

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

    if (!body.description || !body.description.trim()) {
      return new Response(JSON.stringify({ error: "missing_description" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to find matching company by name (case-insensitive, partial match)
    const companyNameNormalized = body.companyName.trim().toLowerCase();
    
    const { data: companies } = await supabase
      .from("onboarding_companies")
      .select("id, name")
      .eq("status", "active");

    let matchedCompanyId: string | null = null;
    let matchedProjectId: string | null = null;

    if (companies && companies.length > 0) {
      // Try exact match first (case-insensitive)
      let matchedCompany = companies.find(
        (c) => c.name.toLowerCase() === companyNameNormalized
      );

      // If no exact match, try partial match (company name contains input or input contains company name)
      if (!matchedCompany) {
        matchedCompany = companies.find(
          (c) =>
            c.name.toLowerCase().includes(companyNameNormalized) ||
            companyNameNormalized.includes(c.name.toLowerCase())
        );
      }

      if (matchedCompany) {
        matchedCompanyId = matchedCompany.id;
        console.log("hotseat-public: matched company", { 
          input: body.companyName, 
          matched: matchedCompany.name,
          id: matchedCompanyId 
        });

        // Try to find active project for this company
        const { data: projects } = await supabase
          .from("onboarding_projects")
          .select("id")
          .eq("onboarding_company_id", matchedCompanyId)
          .eq("status", "active")
          .limit(1);

        if (projects && projects.length > 0) {
          matchedProjectId = projects[0].id;
          console.log("hotseat-public: matched project", { id: matchedProjectId });
        }
      }
    }

    // Insert the hotseat response with matched company/project if found
    const { data: hotseatResponse, error: insertError } = await supabase
      .from("hotseat_responses")
      .insert({
        respondent_name: body.respondentName.trim(),
        company_name: body.companyName.trim(),
        subjects: body.subjects,
        description: body.description?.trim() || null,
        status: "pending",
        linked_company_id: matchedCompanyId,
        linked_project_id: matchedProjectId,
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

    console.log("hotseat-public: response created", { 
      id: hotseatResponse.id,
      linkedCompany: matchedCompanyId,
      linkedProject: matchedProjectId,
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      id: hotseatResponse.id,
      autoLinked: !!matchedCompanyId,
    }), {
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
