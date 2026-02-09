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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { projectId } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "projectId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get briefing data
    const { data: briefing, error: briefingError } = await supabase
      .from("social_briefing_forms")
      .select("*")
      .eq("project_id", projectId)
      .single();

    if (briefingError || !briefing) {
      return new Response(
        JSON.stringify({ error: "Briefing not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt for AI
    const briefingContent = `
# Briefing da Empresa

## Fundação e História
- Desde quando funciona: ${briefing.company_since || "Não informado"}
- Missão/Propósito: ${briefing.mission_purpose || "Não informado"}
- História da fundação: ${briefing.founding_story || "Não informado"}

## Produtos e Serviços
- Produtos/Serviços oferecidos: ${briefing.products_services || "Não informado"}
- Carro-chefe: ${briefing.flagship_products || "Não informado"}
- Diferencial: ${briefing.unique_differentiator || "Não informado"}
- Exclusivos: ${briefing.exclusive_products || "Não informado"}
- Experiência do cliente: ${briefing.customer_experience || "Não informado"}

## Público-Alvo
- Cliente ideal: ${briefing.ideal_customer || "Não informado"}
- Preocupações do cliente: ${briefing.customer_concerns || "Não informado"}
- Objetivos do cliente: ${briefing.customer_goals || "Não informado"}

## Posicionamento
- Como quer ser percebida: ${briefing.brand_perception || "Não informado"}
- O que NÃO comunicar: ${briefing.what_not_to_communicate || "Não informado"}

## Objetivos nas Redes Sociais
- Objetivo principal: ${briefing.social_media_objectives || "Não informado"}
- Inegociáveis: ${briefing.non_negotiables || "Não informado"}
- Gaps no perfil: ${briefing.profile_gaps || "Não informado"}
- Perfis de referência: ${briefing.reference_profiles || "Não informado"}

## Concorrência
- Concorrentes diretos: ${briefing.direct_competitors || "Não informado"}
    `;

    const systemPrompt = `Você é um estrategista de social media especializado em criar resumos executivos de marca.
    
Com base no briefing fornecido, gere um resumo executivo completo que inclua:

1. **Identidade da Marca**: Essência, valores e personalidade
2. **Posicionamento**: Como a marca quer ser percebida no mercado
3. **Tom de Voz**: Estilo de comunicação ideal
4. **Regras de Comunicação**: O que usar e evitar
5. **Hashtags Sugeridas**: Lista de hashtags oficiais recomendadas

Responda em formato JSON com as seguintes chaves:
- brand_identity: texto sobre identidade
- positioning: texto sobre posicionamento
- tone_of_voice: texto sobre tom de voz
- communication_rules: texto sobre regras
- official_hashtags: array de strings com hashtags (sem o #)
- ai_generated_summary: resumo geral em 2-3 parágrafos

Seja específico e prático, usando as informações reais do briefing.`;

    // Call Gemini API
    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
    
    const geminiResponse = await fetch(`${geminiUrl}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: briefingContent }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      throw new Error("Failed to generate profile");
    }

    const geminiData = await geminiResponse.json();
    const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error("No content generated");
    }

    let parsedProfile;
    try {
      parsedProfile = JSON.parse(generatedText);
    } catch {
      console.error("Failed to parse generated content:", generatedText);
      throw new Error("Invalid generated content format");
    }

    // Save to social_company_profiles
    const { error: upsertError } = await supabase
      .from("social_company_profiles")
      .upsert({
        project_id: projectId,
        briefing_id: briefing.id,
        brand_identity: parsedProfile.brand_identity || null,
        positioning: parsedProfile.positioning || null,
        tone_of_voice: parsedProfile.tone_of_voice || null,
        communication_rules: parsedProfile.communication_rules || null,
        official_hashtags: parsedProfile.official_hashtags || null,
        ai_generated_summary: parsedProfile.ai_generated_summary || null,
        ai_generated_at: new Date().toISOString(),
      }, { onConflict: "project_id" });

    if (upsertError) {
      console.error("Error saving profile:", upsertError);
      throw new Error("Failed to save profile");
    }

    // Log audit
    await supabase.from("social_audit_logs").insert({
      project_id: projectId,
      entity_type: "company_profile",
      entity_id: projectId,
      action: "create",
      changes: { generated_from: "briefing", ai_model: "gemini-2.0-flash" },
    });

    return new Response(
      JSON.stringify({ success: true, profile: parsedProfile }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating profile:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
