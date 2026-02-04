import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um estrategista de marketing digital e social media especialista. Sua tarefa é analisar o briefing de uma empresa e gerar análises estratégicas completas.

Você deve retornar um JSON com a seguinte estrutura:

{
  "strategy": {
    "positioning_statement": "Declaração de posicionamento da marca (2-3 frases)",
    "unique_value_proposition": "Proposta de valor única (1-2 parágrafos)",
    "differentiation_strategy": "Estratégia de diferenciação (1-2 parágrafos)",
    "communication_guidelines": "Diretrizes de comunicação (lista de regras)",
    "where_not_to_compete": "Onde NÃO competir (áreas a evitar)",
    "swot_strengths": ["Força 1", "Força 2", ...] (mínimo 5 itens),
    "swot_weaknesses": ["Fraqueza 1", "Fraqueza 2", ...] (mínimo 5 itens),
    "swot_opportunities": ["Oportunidade 1", "Oportunidade 2", ...] (mínimo 5 itens),
    "swot_threats": ["Ameaça 1", "Ameaça 2", ...] (mínimo 5 itens),
    "consolidated_briefing": "Briefing estratégico consolidado (documento completo)"
  },
  "personas": [
    {
      "name": "Nome fictício da persona",
      "age": 35,
      "profession": "Profissão",
      "goals": ["Objetivo 1", "Objetivo 2"],
      "pain_points": ["Dor 1", "Dor 2"],
      "fears": ["Medo 1", "Medo 2"],
      "desires": ["Desejo 1", "Desejo 2"],
      "objections": ["Objeção 1", "Objeção 2"],
      "ideal_language": "Descrição da linguagem ideal",
      "ideal_content_types": ["Reels", "Carrossel"],
      "is_primary": true
    }
  ] (mínimo 2 personas),
  "stories_guide": {
    "stories_objective": "Objetivo principal dos stories",
    "ideal_frequency": "Frequência ideal (ex: 5-10 stories por dia)",
    "story_types": [
      {"type": "bastidores", "description": "Mostrar a rotina...", "percentage": 30},
      {"type": "prova_social", "description": "Depoimentos...", "percentage": 20},
      {"type": "autoridade", "description": "Dicas e conhecimento...", "percentage": 20},
      {"type": "vendas", "description": "Ofertas e CTAs...", "percentage": 15},
      {"type": "relacionamento", "description": "Interação...", "percentage": 15}
    ],
    "ideal_language": "Tom e linguagem para stories",
    "suggested_ctas": ["CTA 1", "CTA 2", "CTA 3"],
    "do_list": ["Fazer 1", "Fazer 2", "Fazer 3"],
    "dont_list": ["Evitar 1", "Evitar 2", "Evitar 3"]
  }
}

IMPORTANTE:
- Seja específico e acionável
- Use linguagem executiva e direta
- Baseie todas as análises nos dados do briefing
- Retorne APENAS o JSON, sem markdown ou explicações`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, briefingId } = await req.json();

    if (!projectId || !briefingId) {
      throw new Error("projectId and briefingId are required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load briefing data
    const { data: briefing, error: briefingError } = await supabase
      .from("social_briefing_forms")
      .select("*")
      .eq("id", briefingId)
      .single();

    if (briefingError || !briefing) {
      throw new Error("Briefing not found");
    }

    // Load company info
    const { data: project } = await supabase
      .from("onboarding_projects")
      .select(`
        product_name,
        onboarding_companies (
          name,
          segment,
          onboarding_company_briefings (
            company_description,
            target_audience,
            competitors
          )
        )
      `)
      .eq("id", projectId)
      .single();

    const companyData = project?.onboarding_companies as any;
    const companyBriefing = companyData?.onboarding_company_briefings?.[0];

    // Build the prompt
    const userPrompt = `
Analise o seguinte briefing de social media e gere as análises estratégicas:

EMPRESA: ${companyData?.name || project?.product_name || "Não informado"}
SEGMENTO: ${companyData?.segment || "Não informado"}

DESCRIÇÃO DO NEGÓCIO:
${briefing.business_description || companyBriefing?.company_description || "Não informado"}

PRODUTOS/SERVIÇOS:
${briefing.main_products_services || "Não informado"}

DIFERENCIAIS:
${briefing.brand_differentials || "Não informado"}

PÚBLICO-ALVO:
${briefing.target_audience || companyBriefing?.target_audience || "Não informado"}

FAIXA ETÁRIA: ${briefing.audience_age_range || "Não informado"}
GÊNERO: ${briefing.audience_gender || "Não informado"}
LOCALIZAÇÃO: ${briefing.audience_location || "Não informado"}
INTERESSES: ${(briefing.audience_interests || []).join(", ") || "Não informado"}

DORES DO PÚBLICO:
${(briefing.audience_pain_points || []).join("\n") || "Não informado"}

OBJEÇÕES COMUNS:
${(briefing.audience_objections || []).join("\n") || "Não informado"}

OBJETIVO PRINCIPAL: ${briefing.primary_objective || "Não informado"}
OBJETIVOS SECUNDÁRIOS: ${(briefing.secondary_objectives || []).join(", ") || "Não informado"}
META DE CRESCIMENTO: ${briefing.growth_goals || "Não informado"}
META DE VENDAS: ${briefing.sales_goals || "Não informado"}

PERSONALIDADE DA MARCA: ${(briefing.brand_personality || []).join(", ") || "Não informado"}
TOM DE VOZ: ${briefing.tone_of_voice || "Não informado"}
PALAVRAS PARA USAR: ${(briefing.words_to_use || []).join(", ") || "Não informado"}
PALAVRAS PARA EVITAR: ${(briefing.words_to_avoid || []).join(", ") || "Não informado"}

CONCORRENTES:
${JSON.stringify(briefing.main_competitors) || "Não informado"}

PONTOS FORTES DOS CONCORRENTES:
${briefing.competitor_strengths || "Não informado"}

PONTOS FRACOS DOS CONCORRENTES:
${briefing.competitor_weaknesses || "Não informado"}

PILARES DE CONTEÚDO: ${(briefing.content_pillars || []).join(", ") || "Não informado"}
TEMAS PARA ABORDAR: ${(briefing.topics_to_cover || []).join(", ") || "Não informado"}
TEMAS PARA EVITAR: ${(briefing.topics_to_avoid || []).join(", ") || "Não informado"}
CTAs PREFERIDOS: ${(briefing.cta_preferences || []).join(", ") || "Não informado"}

RECURSOS:
- Fotos de produtos: ${briefing.has_product_photos ? "Sim" : "Não"}
- Fotos da equipe: ${briefing.has_team_photos ? "Sim" : "Não"}
- Acesso a bastidores: ${briefing.has_behind_scenes_access ? "Sim" : "Não"}
- Formatos preferidos: ${(briefing.preferred_content_formats || []).join(", ") || "Não informado"}

Gere o JSON com todas as análises estratégicas.`;

    console.log("Generating strategy for project:", projectId);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        max_tokens: 8000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from AI");
    }

    // Parse the JSON response
    let parsedContent;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedContent = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response");
    }

    // Save strategy analysis
    const { data: strategyData, error: strategyError } = await supabase
      .from("social_strategy_analysis")
      .upsert({
        project_id: projectId,
        briefing_id: briefingId,
        positioning_statement: parsedContent.strategy?.positioning_statement,
        unique_value_proposition: parsedContent.strategy?.unique_value_proposition,
        differentiation_strategy: parsedContent.strategy?.differentiation_strategy,
        communication_guidelines: parsedContent.strategy?.communication_guidelines,
        where_not_to_compete: parsedContent.strategy?.where_not_to_compete,
        swot_strengths: parsedContent.strategy?.swot_strengths,
        swot_weaknesses: parsedContent.strategy?.swot_weaknesses,
        swot_opportunities: parsedContent.strategy?.swot_opportunities,
        swot_threats: parsedContent.strategy?.swot_threats,
        consolidated_briefing: parsedContent.strategy?.consolidated_briefing,
        generated_by: "ai",
        model_used: "google/gemini-3-flash-preview",
      }, { onConflict: "project_id" })
      .select("id")
      .single();

    if (strategyError) {
      console.error("Error saving strategy:", strategyError);
    }

    // Delete existing personas for this project
    await supabase
      .from("social_personas")
      .delete()
      .eq("project_id", projectId);

    // Save personas
    if (parsedContent.personas && Array.isArray(parsedContent.personas)) {
      const personasToInsert = parsedContent.personas.map((persona: any, index: number) => ({
        project_id: projectId,
        briefing_id: briefingId,
        name: persona.name,
        age: persona.age,
        profession: persona.profession,
        goals: persona.goals,
        pain_points: persona.pain_points,
        fears: persona.fears,
        desires: persona.desires,
        objections: persona.objections,
        ideal_language: persona.ideal_language,
        ideal_content_types: persona.ideal_content_types,
        is_primary: index === 0 || persona.is_primary,
        generated_by: "ai",
        sort_order: index,
      }));

      const { error: personasError } = await supabase
        .from("social_personas")
        .insert(personasToInsert);

      if (personasError) {
        console.error("Error saving personas:", personasError);
      }
    }

    // Save stories guidelines
    if (parsedContent.stories_guide) {
      const { error: storiesError } = await supabase
        .from("social_stories_guidelines")
        .upsert({
          project_id: projectId,
          briefing_id: briefingId,
          stories_objective: parsedContent.stories_guide.stories_objective,
          ideal_frequency: parsedContent.stories_guide.ideal_frequency,
          story_types: parsedContent.stories_guide.story_types,
          ideal_language: parsedContent.stories_guide.ideal_language,
          suggested_ctas: parsedContent.stories_guide.suggested_ctas,
          do_list: parsedContent.stories_guide.do_list,
          dont_list: parsedContent.stories_guide.dont_list,
          generated_by: "ai",
        }, { onConflict: "project_id" });

      if (storiesError) {
        console.error("Error saving stories guide:", storiesError);
      }
    }

    // Log the generation
    await supabase.from("social_strategy_audit_log").insert({
      project_id: projectId,
      action: "generated",
      entity_type: "full_strategy",
      entity_id: strategyData?.id || projectId,
      changes: { model: "google/gemini-3-flash-preview" },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating strategy:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
