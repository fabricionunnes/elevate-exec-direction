import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, message, messages } = await req.json();

    // Fetch all relevant data for CEO analysis
    const fetchBusinessData = async () => {
      // Projects and health
      const { data: projects } = await supabase
        .from("onboarding_projects")
        .select("id, status, start_date, end_date, company_id")
        .in("status", ["onboarding", "active", "churned"]);

      const { data: healthScores } = await supabase
        .from("client_health_scores")
        .select("project_id, total_score, risk_level, engagement_score, satisfaction_score");

      const { data: csatResponses } = await supabase
        .from("csat_responses")
        .select("score, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      // CEO specific data
      const { data: decisions } = await supabase
        .from("ceo_decisions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: decisionResults } = await supabase
        .from("ceo_decision_results")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: tasks } = await supabase
        .from("ceo_tasks")
        .select("*")
        .eq("status", "pendente")
        .order("due_date", { ascending: true });

      const { data: alerts } = await supabase
        .from("ceo_alerts")
        .select("*")
        .eq("is_dismissed", false)
        .order("created_at", { ascending: false });

      const { data: planning } = await supabase
        .from("ceo_planning")
        .select("*")
        .gte("year", new Date().getFullYear())
        .order("year", { ascending: true })
        .order("month", { ascending: true });

      const { data: goals } = await supabase
        .from("ceo_strategic_goals")
        .select("*")
        .eq("status", "active");

      // CRM Data
      const { data: leads } = await supabase
        .from("crm_leads")
        .select("id, stage_id, opportunity_value, created_at, closed_at")
        .order("created_at", { ascending: false })
        .limit(200);

      // Calculate metrics
      const activeProjects = projects?.filter(p => p.status === "active") || [];
      const churnedProjects = projects?.filter(p => p.status === "churned") || [];
      const estimatedMRR = activeProjects.length * 5000;

      const avgCSAT = csatResponses?.length 
        ? csatResponses.reduce((acc, r) => acc + r.score, 0) / csatResponses.length 
        : 0;

      const atRiskClients = healthScores?.filter(h => h.risk_level === "high" || h.risk_level === "critical") || [];

      return {
        metrics: {
          totalActiveClients: activeProjects.length,
          churnedClients: churnedProjects.length,
          estimatedMRR,
          avgCSAT: avgCSAT.toFixed(1),
          atRiskClients: atRiskClients.length,
          pendingTasks: tasks?.length || 0,
          activeAlerts: alerts?.length || 0,
          activeGoals: goals?.length || 0,
        },
        decisions: decisions || [],
        decisionResults: decisionResults || [],
        alerts: alerts || [],
        planning: planning || [],
        goals: goals || [],
        healthScores: healthScores || [],
        leads: leads || [],
      };
    };

    const businessData = await fetchBusinessData();

    const systemPrompt = `Você é um conselheiro executivo sênior (CEO/CFO/COO) altamente experiente para a Universidade de Vendas (UNV).

PERFIL DE COMUNICAÇÃO:
- Seja direto, estratégico e objetivo
- Use linguagem de conselho executivo
- Sem floreios ou explicações desnecessárias
- Foque em decisões e ações concretas
- Priorize impacto no negócio

DADOS ATUAIS DO NEGÓCIO:
${JSON.stringify(businessData.metrics, null, 2)}

DECISÕES RECENTES DO CEO:
${JSON.stringify(businessData.decisions.slice(0, 5), null, 2)}

RESULTADOS DAS DECISÕES:
${JSON.stringify(businessData.decisionResults.slice(0, 10), null, 2)}

ALERTAS ATIVOS:
${JSON.stringify(businessData.alerts.slice(0, 5), null, 2)}

METAS ESTRATÉGICAS:
${JSON.stringify(businessData.goals, null, 2)}

PLANEJAMENTO:
${JSON.stringify(businessData.planning.slice(0, 6), null, 2)}

CLIENTES EM RISCO:
${businessData.healthScores.filter(h => h.risk_level === "high" || h.risk_level === "critical").length} clientes em alto risco

INSTRUÇÕES:
1. Analise os dados e forneça insights estratégicos
2. Identifique riscos críticos e oportunidades
3. Sugira ações específicas e priorizadas
4. Conecte decisões passadas com resultados
5. Sempre indique a urgência (crítico, importante, oportunidade)
6. Responda em português brasileiro`;

    if (action === "generate-insights") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY not configured");
      }

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
            { 
              role: "user", 
              content: `Analise todos os dados do negócio e gere 3-5 insights/recomendações priorizados. 
              
Para cada insight, retorne no formato JSON:
{
  "recommendations": [
    {
      "insight": "descrição clara do insight",
      "category": "critico" | "importante" | "oportunidade",
      "type": "insight" | "sugestao" | "alerta",
      "area": "financeiro" | "comercial" | "clientes" | "operacoes" | "estrategia",
      "suggested_action": "ação recomendada"
    }
  ]
}

Foque em:
1. Riscos imediatos ao negócio
2. Tendências preocupantes
3. Oportunidades de crescimento
4. Conexões entre decisões e resultados`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "generate_recommendations",
              description: "Generate CEO recommendations based on business data",
              parameters: {
                type: "object",
                properties: {
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        insight: { type: "string" },
                        category: { type: "string", enum: ["critico", "importante", "oportunidade"] },
                        type: { type: "string", enum: ["insight", "sugestao", "alerta"] },
                        area: { type: "string" },
                        suggested_action: { type: "string" }
                      },
                      required: ["insight", "category", "type", "suggested_action"]
                    }
                  }
                },
                required: ["recommendations"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "generate_recommendations" } }
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "chat") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY not configured");
      }

      const chatMessages = [
        { role: "system", content: systemPrompt },
        ...(messages || []),
        { role: "user", content: message }
      ];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: chatMessages,
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI gateway error: ${response.status}`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("CEO AI error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
