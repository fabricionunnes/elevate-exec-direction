import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to calculate MRR from companies
const calculateMRRFromCompanies = (companies: any[]): number => {
  let mrr = 0;
  
  companies?.forEach((c) => {
    const value = Number(c.contract_value) || 0;
    const paymentMethod = c.payment_method?.toLowerCase() || "";
    
    // Monthly payments = value is already monthly
    if (paymentMethod === "monthly" || paymentMethod === "mensal" || paymentMethod === "recorrente") {
      mrr += value;
    }
    // Quarterly = value / 3
    else if (paymentMethod === "quarterly" || paymentMethod === "trimestral") {
      mrr += value / 3;
    }
    // Semiannual = value / 6
    else if (paymentMethod === "semiannual" || paymentMethod === "semestral") {
      mrr += value / 6;
    }
    // Annual or card (typically annual payments) = value / 12
    else if (paymentMethod === "annual" || paymentMethod === "anual" || paymentMethod === "card" || paymentMethod === "cartao" || paymentMethod === "cartão") {
      mrr += value / 12;
    }
    // Boleto or pix could be annual too
    else if (paymentMethod === "boleto" || paymentMethod === "pix") {
      mrr += value / 12;
    }
    // Skip one-time payments (à vista, único)
    else if (paymentMethod.includes("vista") || paymentMethod.includes("unico") || paymentMethod.includes("único")) {
      // Don't add to MRR - one-time payment
    }
    // Unknown payment method with value > 1000 assume annual
    else if (value > 1000) {
      mrr += value / 12;
    }
    // Small values without payment method, assume monthly
    else if (value > 0) {
      mrr += value;
    }
  });
  
  return mrr;
};

Deno.serve(async (req) => {
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
      // Fetch active companies with contract values (main MRR source)
      const { data: companies } = await supabase
        .from("onboarding_companies")
        .select("id, contract_value, payment_method, status")
        .eq("status", "active");

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

      // Board Virtual data
      const { data: boardSessions } = await supabase
        .from("ceo_board_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: boardOpinions } = await supabase
        .from("ceo_board_opinions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      // Simulator data
      const { data: simulations } = await supabase
        .from("ceo_simulations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      // Calculate MRR from active companies
      const currentMRR = calculateMRRFromCompanies(companies || []);
      const activeClients = companies?.length || 0;

      // Calculate metrics
      const activeProjects = projects?.filter(p => p.status === "active") || [];
      const churnedProjects = projects?.filter(p => p.status === "churned") || [];

      const avgCSAT = csatResponses?.length 
        ? csatResponses.reduce((acc, r) => acc + r.score, 0) / csatResponses.length 
        : 0;

      const atRiskClients = healthScores?.filter(h => h.risk_level === "high" || h.risk_level === "critical") || [];

      // Board and Simulator metrics
      const completedBoardSessions = boardSessions?.filter(s => s.status === "completed") || [];
      const executedSimulations = simulations?.filter(s => s.status === "executed") || [];
      const simulationsWithPredictionError = simulations?.filter(s => s.prediction_error !== null) || [];
      const avgPredictionError = simulationsWithPredictionError.length > 0
        ? simulationsWithPredictionError.reduce((acc, s) => acc + Math.abs(s.prediction_error || 0), 0) / simulationsWithPredictionError.length
        : null;

      return {
        metrics: {
          totalActiveClients: activeClients,
          totalActiveProjects: activeProjects.length,
          churnedClients: churnedProjects.length,
          currentMRR,
          formattedMRR: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(currentMRR),
          avgCSAT: avgCSAT.toFixed(1),
          atRiskClients: atRiskClients.length,
          pendingTasks: tasks?.length || 0,
          activeAlerts: alerts?.length || 0,
          activeGoals: goals?.length || 0,
          boardSessionsCompleted: completedBoardSessions.length,
          simulationsExecuted: executedSimulations.length,
          avgSimulationAccuracy: avgPredictionError !== null ? (100 - avgPredictionError).toFixed(1) : null,
        },
        decisions: decisions || [],
        decisionResults: decisionResults || [],
        alerts: alerts || [],
        planning: planning || [],
        goals: goals || [],
        healthScores: healthScores || [],
        leads: leads || [],
        boardSessions: boardSessions || [],
        boardOpinions: boardOpinions || [],
        simulations: simulations || [],
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
- MRR Atual: ${businessData.metrics.formattedMRR}
- Clientes Ativos: ${businessData.metrics.totalActiveClients}
- Projetos Ativos: ${businessData.metrics.totalActiveProjects}
- Clientes Churned: ${businessData.metrics.churnedClients}
- CSAT Médio: ${businessData.metrics.avgCSAT}
- Clientes em Risco: ${businessData.metrics.atRiskClients}
- Tarefas Pendentes: ${businessData.metrics.pendingTasks}
- Alertas Ativos: ${businessData.metrics.activeAlerts}
- Metas Ativas: ${businessData.metrics.activeGoals}
- Sessões do Board Completadas: ${businessData.metrics.boardSessionsCompleted}
- Simulações Executadas: ${businessData.metrics.simulationsExecuted}
${businessData.metrics.avgSimulationAccuracy ? `- Precisão Média das Simulações: ${businessData.metrics.avgSimulationAccuracy}%` : ""}

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

BOARD VIRTUAL (Sessões recentes do conselho virtual):
${JSON.stringify(businessData.boardSessions.slice(0, 5).map(s => ({
  titulo: s.decision_title,
  decisao_ceo: s.ceo_decision,
  recomendacao: s.final_recommendation,
  riscos_criticos: s.critical_risks,
  data: s.created_at
})), null, 2)}

SIMULAÇÕES DE DECISÕES:
${JSON.stringify(businessData.simulations.slice(0, 5).map(s => ({
  titulo: s.title,
  tipo: s.decision_type,
  status: s.status,
  impacto_realista: s.realistic_revenue_impact,
  erro_previsao: s.prediction_error,
  data: s.created_at
})), null, 2)}

INSTRUÇÕES:
1. Analise os dados e forneça insights estratégicos
2. Identifique riscos críticos e oportunidades
3. Sugira ações específicas e priorizadas
4. Conecte decisões passadas com resultados
5. Considere as análises do Board Virtual e Simulações
6. Avalie a precisão das simulações passadas
7. Sempre indique a urgência (crítico, importante, oportunidade)
8. Responda em português brasileiro`;

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
