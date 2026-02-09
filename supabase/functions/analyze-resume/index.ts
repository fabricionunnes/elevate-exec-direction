import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resumeId, jobOpeningId } = await req.json();

    if (!resumeId || !jobOpeningId) {
      return new Response(
        JSON.stringify({ error: "resumeId and jobOpeningId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get resume data
    const { data: resume, error: resumeError } = await supabase
      .from("candidate_resumes")
      .select("*, candidate:candidates(id, full_name, email)")
      .eq("id", resumeId)
      .single();

    if (resumeError || !resume) {
      console.error("Resume not found:", resumeError);
      return new Response(
        JSON.stringify({ error: "Resume not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get job opening data
    const { data: job, error: jobError } = await supabase
      .from("job_openings")
      .select("*")
      .eq("id", jobOpeningId)
      .single();

    if (jobError || !job) {
      console.error("Job not found:", jobError);
      return new Response(
        JSON.stringify({ error: "Job opening not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download and extract text from resume
    let resumeContent = "";
    try {
      const response = await fetch(resume.file_url);
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        
        if (contentType.includes("text") || resume.file_type?.includes("text")) {
          resumeContent = await response.text();
        } else {
          // For PDFs and other binary formats, we'll note this limitation
          resumeContent = `[Arquivo: ${resume.file_name}]`;
        }
      }
    } catch (e) {
      console.error("Error downloading resume:", e);
      resumeContent = `[Arquivo: ${resume.file_name}]`;
    }

    // Build job context
    const jobContext = `
VAGA: ${job.title}
ÁREA: ${job.area || "Não especificada"}
TIPO: ${job.job_type || "Não especificado"}
DESCRIÇÃO: ${job.description || "Não informada"}
REQUISITOS: ${job.requirements || "Não informados"}
SALÁRIO: ${job.salary_range || "A combinar"}
`.trim();

    // Call AI for analysis
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um especialista em recrutamento e seleção. Analise currículos de candidatos comparando com os requisitos da vaga.

REGRAS IMPORTANTES:
1. Seja RIGOROSO na análise - se o arquivo não parece ser um currículo real (sem experiências, formação ou dados profissionais), dê nota BAIXA
2. Se o conteúdo não contém informações de um currículo válido, classifique como "low_fit" com score menor que 40
3. Avalie apenas informações concretas apresentadas
4. Seja objetivo e honesto na análise

Retorne SEMPRE um JSON válido com esta estrutura:
{
  "compatibility_score": número de 0 a 100,
  "classification": "high_fit" | "medium_fit" | "low_fit",
  "strengths": ["array de pontos fortes identificados"],
  "concerns": ["array de pontos de atenção ou gaps"],
  "recommendation": "advance" | "evaluate_carefully" | "reject",
  "full_analysis": "análise detalhada em texto"
}`;

    const userPrompt = `DADOS DA VAGA:
${jobContext}

CURRÍCULO DO CANDIDATO (${resume.candidate.full_name}):
${resumeContent || "[Conteúdo do arquivo não pôde ser extraído - considere como informação insuficiente]"}

Analise a compatibilidade do candidato com a vaga e retorne o JSON de avaliação.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido, tente novamente mais tarde" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para IA" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    
    // Parse AI response
    let evaluation;
    try {
      // Extract JSON from response (handling markdown code blocks)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch (e) {
      console.error("Error parsing AI response:", e, aiContent);
      // Fallback to low score if AI response is invalid
      evaluation = {
        compatibility_score: 30,
        classification: "low_fit",
        strengths: [],
        concerns: ["Não foi possível analisar o currículo adequadamente"],
        recommendation: "evaluate_carefully",
        full_analysis: "A análise automática não conseguiu processar o conteúdo. Recomenda-se revisão manual.",
      };
    }

    // Save evaluation to database
    const { data: savedEval, error: saveError } = await supabase
      .from("candidate_ai_evaluations")
      .insert({
        candidate_id: resume.candidate.id,
        resume_id: resumeId,
        job_opening_id: jobOpeningId,
        compatibility_score: evaluation.compatibility_score,
        classification: evaluation.classification,
        strengths: evaluation.strengths || [],
        concerns: evaluation.concerns || [],
        recommendation: evaluation.recommendation,
        full_analysis: evaluation.full_analysis,
        model_used: "gemini-2.5-flash",
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving evaluation:", saveError);
      return new Response(
        JSON.stringify({ error: "Error saving evaluation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, evaluation: savedEval }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-resume:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
