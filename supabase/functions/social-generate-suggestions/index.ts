import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um estrategista de conteúdo para redes sociais. Sua tarefa é gerar sugestões de conteúdo baseadas na estratégia, personas e posicionamento da marca.

Retorne um JSON com a seguinte estrutura:
{
  "suggestions": [
    {
      "title": "Título atrativo do conteúdo",
      "content_format": "feed" | "reels" | "stories" | "carousel",
      "objective": "engajamento" | "autoridade" | "conversao" | "relacionamento",
      "theme": "Tema principal",
      "creative_idea": "Descrição visual do criativo",
      "copy_idea": "Sugestão de texto/legenda",
      "suggested_cta": "Call to action sugerido",
      "hashtag_suggestions": ["#hashtag1", "#hashtag2"]
    }
  ]
}

REGRAS:
- Gere entre 8 e 12 sugestões variadas
- Distribua entre os formatos (feed, reels, stories, carousel)
- Distribua entre os objetivos
- Baseie nas personas e dores do público
- Use o tom de voz definido
- Seja específico e acionável
- Retorne APENAS o JSON`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId } = await req.json();

    if (!projectId) {
      throw new Error("projectId is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load strategy
    const { data: strategy } = await supabase
      .from("social_strategy_analysis")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Load personas
    const { data: personas } = await supabase
      .from("social_personas")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true);

    // Load briefing
    const { data: briefing } = await supabase
      .from("social_briefing_forms")
      .select("*")
      .eq("project_id", projectId)
      .single();

    if (!strategy && !briefing) {
      throw new Error("Nenhuma estratégia ou briefing encontrado. Complete o briefing primeiro.");
    }

    // Build context
    const userPrompt = `
Gere sugestões de conteúdo para as seguintes configurações:

POSICIONAMENTO:
${strategy?.positioning_statement || "Não definido"}

PROPOSTA DE VALOR:
${strategy?.unique_value_proposition || "Não definido"}

SWOT - FORÇAS:
${(strategy?.swot_strengths || []).join("\n")}

SWOT - OPORTUNIDADES:
${(strategy?.swot_opportunities || []).join("\n")}

PERSONAS:
${(personas || []).map(p => `
- ${p.name}: ${p.profession}
  Dores: ${(p.pain_points || []).join(", ")}
  Desejos: ${(p.desires || []).join(", ")}
  Conteúdos preferidos: ${(p.ideal_content_types || []).join(", ")}
`).join("\n")}

TOM DE VOZ: ${briefing?.tone_of_voice || "Não definido"}
PERSONALIDADE: ${(briefing?.brand_personality || []).join(", ") || "Não definido"}

PILARES DE CONTEÚDO: ${(briefing?.content_pillars || []).join(", ") || "Não definido"}
OBJETIVO PRINCIPAL: ${briefing?.primary_objective || "Não definido"}
CTAs PREFERIDOS: ${(briefing?.cta_preferences || []).join(", ") || "Não definido"}

Gere sugestões de conteúdo variadas e relevantes.`;

    console.log("Generating content suggestions for project:", projectId);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        max_tokens: 4000,
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
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from AI");
    }

    // Parse JSON
    let parsedContent;
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedContent = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response");
    }

    // Save suggestions
    if (parsedContent.suggestions && Array.isArray(parsedContent.suggestions)) {
      const suggestionsToInsert = parsedContent.suggestions.map((s: any) => ({
        project_id: projectId,
        briefing_id: briefing?.id,
        title: s.title,
        content_format: s.content_format,
        objective: s.objective,
        theme: s.theme,
        creative_idea: s.creative_idea,
        copy_idea: s.copy_idea,
        suggested_cta: s.suggested_cta,
        hashtag_suggestions: s.hashtag_suggestions,
        status: "pending",
        generated_by: "ai",
      }));

      const { error: insertError } = await supabase
        .from("social_content_suggestions")
        .insert(suggestionsToInsert);

      if (insertError) {
        console.error("Error saving suggestions:", insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: parsedContent.suggestions?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
