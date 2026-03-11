import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { summaryData } = await req.json();

    if (!summaryData) {
      return new Response(JSON.stringify({ error: "No data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `Você é um analista especialista em retenção de clientes de uma consultoria de vendas chamada UNV (Universidade de Vendas). Analise os seguintes dados e gere insights estratégicos em português brasileiro.

DADOS:
- Empresas ativas: ${summaryData.total_active}
- Total cancelados: ${summaryData.total_cancelled}
- Em aviso atualmente: ${summaryData.in_notice}
- Tentativas de retenção: ${summaryData.retention_attempts}
- Retidos com sucesso: ${summaryData.retained}
- Taxa de retenção: ${summaryData.retention_attempts > 0 ? ((summaryData.retained / summaryData.retention_attempts) * 100).toFixed(1) : 0}%

MOTIVOS DE CANCELAMENTO:
${JSON.stringify(summaryData.reasons, null, 2)}

SEGMENTOS (churned vs active):
${JSON.stringify(summaryData.segments, null, 2)}

CONSULTORES (churned vs retained):
${JSON.stringify(summaryData.consultants, null, 2)}

Gere um relatório com:
1. **Resumo Executivo** - visão geral da situação de churn
2. **Principais Causas de Cancelamento** - análise dos motivos mais frequentes
3. **Segmentos em Risco** - quais segmentos têm maior taxa de churn
4. **Performance dos Consultores** - quem retém melhor e quem precisa de apoio
5. **Padrões Identificados** - tendências e padrões relevantes
6. **Oportunidades de Melhoria** - ações concretas recomendadas
7. **Estratégias de Retenção Sugeridas** - táticas específicas para reduzir churn

Seja direto, use dados concretos e dê recomendações acionáveis. Use formatação markdown.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI API returned ${response.status}`);
    }

    const result = await response.json();
    const insights = result.choices?.[0]?.message?.content || "Sem insights disponíveis.";

    return new Response(JSON.stringify({ insights }), {
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
