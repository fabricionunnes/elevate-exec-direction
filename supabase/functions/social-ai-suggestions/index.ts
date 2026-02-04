import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { projectId, contentType, quantity } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "projectId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load briefing data
    const { data: briefing, error: briefingError } = await supabase
      .from("social_briefing_forms")
      .select("*")
      .eq("project_id", projectId)
      .single();

    if (briefingError) {
      console.log("No briefing found, will use company profile only");
    }

    // Load company profile
    const { data: profile } = await supabase
      .from("social_company_profiles")
      .select("*")
      .eq("project_id", projectId)
      .single();

    // Load project info
    const { data: project } = await supabase
      .from("onboarding_projects")
      .select("product_name, company:onboarding_companies(name)")
      .eq("id", projectId)
      .single();

    const companyName = (project?.company as any)?.name || project?.product_name || "Empresa";

    // Build context from all available data
    const context = buildContext(briefing, profile, companyName);

    // Build prompt for AI
    const systemPrompt = `Você é um estrategista de social media especializado em criar ideias de conteúdo para Instagram.

Com base no contexto da marca fornecido, gere ${quantity || 5} ideias de conteúdo para ${contentType === "all" ? "diferentes formatos (Feed, Reels e Stories)" : contentType}.

Para cada sugestão, forneça:
1. Formato: feed_post | carousel | reel | story
2. Título: título curto e impactante
3. Tema: categoria/pilar de conteúdo
4. Objetivo: o que queremos alcançar (engajamento, vendas, autoridade, etc.)
5. Descrição: descrição detalhada do conteúdo
6. Copy: texto da legenda pronto para usar (com emojis e hashtags)
7. Visual: descrição detalhada do visual/imagem para criar
8. CTA: chamada para ação

IMPORTANTE:
- Use o tom de voz e personalidade da marca
- Evite os temas/palavras que a marca não quer comunicar
- Alinhe com os objetivos de social media da marca
- Seja criativo e diferenciado

Responda APENAS com JSON válido no formato:
{
  "suggestions": [
    {
      "format": "feed_post",
      "title": "...",
      "theme": "...",
      "objective": "...",
      "description": "...",
      "copy": "...",
      "visual_description": "...",
      "cta": "..."
    }
  ]
}`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Failed to generate suggestions");
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices?.[0]?.message?.content;

    if (!generatedText) {
      throw new Error("No content generated");
    }

    // Parse the JSON response
    let suggestions;
    try {
      // Extract JSON from potential markdown code blocks
      let jsonText = generatedText;
      if (jsonText.includes("```json")) {
        jsonText = jsonText.split("```json")[1].split("```")[0];
      } else if (jsonText.includes("```")) {
        jsonText = jsonText.split("```")[1].split("```")[0];
      }
      suggestions = JSON.parse(jsonText.trim());
    } catch {
      console.error("Failed to parse AI response:", generatedText);
      throw new Error("Invalid response format from AI");
    }

    // Log for audit
    await supabase.from("social_audit_logs").insert({
      project_id: projectId,
      entity_type: "ai_suggestions",
      entity_id: projectId,
      action: "generate",
      changes: { 
        content_type: contentType,
        quantity: quantity,
        suggestions_count: suggestions.suggestions?.length || 0
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        suggestions: suggestions.suggestions || [],
        context_used: {
          has_briefing: !!briefing,
          has_profile: !!profile,
          company_name: companyName
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating suggestions:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildContext(briefing: any, profile: any, companyName: string): string {
  let context = `# Contexto da Marca: ${companyName}\n\n`;

  if (profile) {
    context += `## Perfil da Marca\n`;
    if (profile.brand_identity) context += `- Identidade: ${profile.brand_identity}\n`;
    if (profile.positioning) context += `- Posicionamento: ${profile.positioning}\n`;
    if (profile.tone_of_voice) context += `- Tom de Voz: ${profile.tone_of_voice}\n`;
    if (profile.communication_rules) context += `- Regras de Comunicação: ${profile.communication_rules}\n`;
    if (profile.official_hashtags?.length > 0) context += `- Hashtags Oficiais: #${profile.official_hashtags.join(" #")}\n`;
    context += "\n";
  }

  if (briefing) {
    context += `## Sobre a Empresa\n`;
    if (briefing.mission_purpose) context += `- Missão/Propósito: ${briefing.mission_purpose}\n`;
    if (briefing.products_services) context += `- Produtos/Serviços: ${briefing.products_services}\n`;
    if (briefing.flagship_products) context += `- Carro-chefe: ${briefing.flagship_products}\n`;
    if (briefing.unique_differentiator) context += `- Diferencial: ${briefing.unique_differentiator}\n`;
    context += "\n";

    context += `## Público-Alvo\n`;
    if (briefing.ideal_customer) context += `- Cliente ideal: ${briefing.ideal_customer}\n`;
    if (briefing.customer_concerns) context += `- Preocupações: ${briefing.customer_concerns}\n`;
    if (briefing.customer_goals) context += `- Objetivos: ${briefing.customer_goals}\n`;
    context += "\n";

    context += `## Posicionamento & Tom\n`;
    if (briefing.brand_perception) context += `- Como quer ser percebida: ${briefing.brand_perception}\n`;
    if (briefing.what_not_to_communicate) context += `- O que NÃO comunicar: ${briefing.what_not_to_communicate}\n`;
    context += "\n";

    context += `## Objetivos nas Redes Sociais\n`;
    if (briefing.social_media_objectives) context += `- Objetivo principal: ${briefing.social_media_objectives}\n`;
    if (briefing.non_negotiables) context += `- Inegociáveis: ${briefing.non_negotiables}\n`;
    if (briefing.profile_gaps) context += `- Gaps no perfil: ${briefing.profile_gaps}\n`;
    context += "\n";

    if (briefing.direct_competitors) {
      context += `## Concorrência\n`;
      context += `- Concorrentes diretos: ${briefing.direct_competitors}\n`;
    }
  }

  return context;
}
