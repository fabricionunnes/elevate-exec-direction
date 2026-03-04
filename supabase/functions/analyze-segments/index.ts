import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segments, totalCompanies, noSegmentCount } = await req.json();

    const prompt = `Você é a IA de Análise de Segmentos da Universidade Nacional de Vendas (UNV).

Analise os dados abaixo e gere um relatório estratégico em português do Brasil.

Total de empresas: ${totalCompanies}
Empresas sem segmento: ${noSegmentCount}

Dados por segmento:
${JSON.stringify(segments, null, 2)}

Gere insights sobre:
1. Quais segmentos têm os melhores resultados (maior entrega de metas)
2. Quais segmentos têm maior satisfação (CSAT e NPS mais altos)
3. Quais segmentos apresentam maior risco (saúde baixa)
4. Oportunidades de crescimento
5. Recomendações estratégicas

Seja objetivo e direto. Use bullet points e emojis para facilitar a leitura.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

    const response = await fetch("https://api.lovable.dev/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Sem análise disponível.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
