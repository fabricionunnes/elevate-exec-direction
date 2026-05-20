import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth via x-api-key
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("JOB_OPENING_API_KEY");

    if (!expectedKey || apiKey !== expectedKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: API key inválida ou ausente" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    const {
      title,
      area,
      job_type,
      project_id,
      description,
      requirements,
      differentials,
      salary_range,
      seniority,
      location,
      is_remote,
      contract_model,
      target_date,
      sla_days,
      company_id,
    } = body;

    // Validate required fields
    if (!title || !area || !job_type || !project_id) {
      return new Response(
        JSON.stringify({
          error: "Campos obrigatórios ausentes: title, area, job_type, project_id",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("job_openings")
      .insert({
        title,
        area,
        job_type,
        project_id,
        description: description || null,
        requirements: requirements || null,
        differentials: differentials || null,
        salary_range: salary_range || null,
        seniority: seniority || null,
        location: location || null,
        is_remote: is_remote ?? false,
        contract_model: contract_model || null,
        target_date: target_date || null,
        sla_days: sla_days || null,
        company_id: company_id || null,
        status: "open",
      })
      .select("id, title, status, created_at")
      .single();

    if (error) {
      console.error("Error inserting job opening:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao criar vaga", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Job opening created:", data.id);

    return new Response(
      JSON.stringify({
        success: true,
        job_opening_id: data.id,
        title: data.title,
        status: data.status,
        created_at: data.created_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
