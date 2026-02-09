// circle-ai-quality - no external deps needed

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QualityRequest {
  content: string;
  type: "pre_publish" | "analyze";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { content, type } = await req.json() as QualityRequest;

    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é a IA de Qualidade do UNV Circle, uma rede social profissional.
Sua função é analisar posts ANTES da publicação e sugerir melhorias construtivas.

IMPORTANTE:
- Você NÃO bloqueia posts
- Você apenas sugere melhorias de forma amigável
- Seja conciso e prático
- Foque em ajudar, não criticar

Analise o conteúdo e forneça sugestões em formato JSON.`;

    const userPrompt = `Analise este post e sugira melhorias:

"${content}"

Responda APENAS com um JSON no formato:
{
  "clarity_score": 1-10,
  "clarity_suggestion": "sugestão para melhorar clareza ou null se ok",
  "tone_analysis": "positivo|neutro|negativo|agressivo",
  "tone_suggestion": "sugestão de tom ou null se ok",
  "has_cta": true/false,
  "cta_suggestion": "sugestão de CTA ou null se desnecessário",
  "objective": "resultado|dúvida|venda|reflexão|celebração|outro",
  "hashtag_suggestions": ["#tag1", "#tag2"],
  "overall_quality": 1-10,
  "quick_tip": "uma dica rápida principal"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    let suggestions;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        suggestions = {
          clarity_score: 7,
          overall_quality: 7,
          quick_tip: "Conteúdo parece bom! Publique com confiança.",
        };
      }
    } catch {
      suggestions = {
        clarity_score: 7,
        overall_quality: 7,
        quick_tip: "Conteúdo parece bom! Publique com confiança.",
      };
    }

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in circle-ai-quality:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
