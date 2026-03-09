import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectId, segment, businessModel, ticketRange, saleType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const prompt = `Gere um funil de vendas personalizado para uma empresa com as seguintes características:
- Segmento: ${segment}
- Modelo de Negócio: ${businessModel}
- Ticket Médio: ${ticketRange}
- Tipo de Venda: ${saleType}

Retorne um JSON com a seguinte estrutura:
{
  "name": "Nome do funil",
  "description": "Descrição breve",
  "stages": [
    {
      "name": "Nome da etapa",
      "type": "entry|qualification|meeting|demo|proposal|negotiation|followup|closing|lost|post_sale|custom",
      "color": "#hex",
      "conversion_rate": 80,
      "avg_time_days": 2,
      "x": 400,
      "y": 50
    }
  ],
  "connections": [
    { "from": 0, "to": 1 }
  ]
}

Crie entre 5 e 8 etapas que façam sentido para o segmento. Inclua taxas de conversão realistas e tempos médios. Use cores diferentes para cada etapa. Posicione verticalmente com y incrementando de 80 em 80.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um especialista em processos comerciais e funis de vendas. Sempre responda em JSON válido." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_funnel",
              description: "Creates a sales funnel with stages and connections",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  stages: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        type: { type: "string" },
                        color: { type: "string" },
                        conversion_rate: { type: "number" },
                        avg_time_days: { type: "number" },
                        x: { type: "number" },
                        y: { type: "number" },
                      },
                      required: ["name", "type", "color", "x", "y"],
                    },
                  },
                  connections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        from: { type: "number" },
                        to: { type: "number" },
                      },
                      required: ["from", "to"],
                    },
                  },
                },
                required: ["name", "description", "stages", "connections"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_funnel" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("AI generation failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const funnelData = JSON.parse(toolCall.function.arguments);

    // Create funnel
    const { data: funnel, error: funnelErr } = await supabase
      .from("sales_funnels")
      .insert({ project_id: projectId, name: funnelData.name, description: funnelData.description })
      .select("id")
      .single();

    if (funnelErr) throw funnelErr;

    // Create stages
    const stagesPayload = funnelData.stages.map((s: any, idx: number) => ({
      funnel_id: funnel.id,
      name: s.name,
      stage_type: s.type || "custom",
      color: s.color || "#3b82f6",
      position_x: s.x || 400,
      position_y: s.y || idx * 80 + 50,
      sort_order: idx,
      expected_conversion_rate: s.conversion_rate || null,
      expected_avg_time_days: s.avg_time_days || null,
    }));

    const { data: createdStages, error: stagesErr } = await supabase
      .from("sales_funnel_stages")
      .insert(stagesPayload)
      .select("id");

    if (stagesErr) throw stagesErr;

    // Create connections
    if (createdStages && funnelData.connections) {
      const conns = funnelData.connections
        .filter((c: any) => createdStages[c.from] && createdStages[c.to])
        .map((c: any) => ({
          funnel_id: funnel.id,
          from_stage_id: createdStages[c.from].id,
          to_stage_id: createdStages[c.to].id,
        }));

      if (conns.length > 0) {
        await supabase.from("sales_funnel_connections").insert(conns);
      }
    }

    return new Response(JSON.stringify({ funnelId: funnel.id }), {
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
