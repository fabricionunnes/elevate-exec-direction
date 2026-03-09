import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { funnelId, stages, connections } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const stagesInfo = stages.map((s: any, idx: number) => 
      `${idx + 1}. ${s.name} (tipo: ${s.stage_type}, conversão: ${s.expected_conversion_rate || 'N/A'}%, tempo: ${s.expected_avg_time_days || 'N/A'} dias)`
    ).join("\n");

    const connectionsInfo = connections.map((c: any) => {
      const fromName = stages.find((s: any) => s.id === c.from_stage_id)?.name || "?";
      const toName = stages.find((s: any) => s.id === c.to_stage_id)?.name || "?";
      return `${fromName} → ${toName}`;
    }).join(", ");

    const prompt = `Analise este funil de vendas e gere insights de otimização:

Etapas:
${stagesInfo}

Conexões: ${connectionsInfo}

Gere de 3 a 6 insights práticos sobre:
1. Gargalos identificados
2. Etapas desnecessárias
3. Oportunidades de melhoria de conversão
4. Sugestões de automação
5. Comparação com melhores práticas`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um consultor especialista em otimização de processos comerciais." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_insights",
              description: "Returns optimization insights for the sales funnel",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        severity: { type: "string", enum: ["critical", "warning", "info", "success"] },
                      },
                      required: ["title", "description", "severity"],
                    },
                  },
                },
                required: ["insights"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_insights" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("AI optimization failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
