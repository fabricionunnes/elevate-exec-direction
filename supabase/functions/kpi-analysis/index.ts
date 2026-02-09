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
    const { companyId, projectId, startDate, endDate, periodLabel, customPrompt } = await req.json();

    console.log("KPI Analysis request for company:", companyId, "project:", projectId);
    console.log("Period:", startDate, "to", endDate, "label:", periodLabel);
    if (customPrompt) console.log("Custom prompt:", customPrompt);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all necessary data
    console.log("Fetching data...");

    // 1. Company info
    const { data: company } = await supabase
      .from("onboarding_companies")
      .select("*")
      .eq("id", companyId)
      .single();

    // 2. Project info
    const { data: project } = await supabase
      .from("onboarding_projects")
      .select("*")
      .eq("id", projectId)
      .single();

    // 3. KPIs configuration
    const { data: kpis } = await supabase
      .from("company_kpis")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("sort_order");

    // 4. Salespeople
    const { data: salespeople } = await supabase
      .from("company_salespeople")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name");

    // 5. KPI Entries - use provided period dates
    const periodStart = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const periodEnd = endDate || new Date().toISOString().split('T')[0];
    
    const { data: entries } = await supabase
      .from("kpi_entries")
      .select("*")
      .eq("company_id", companyId)
      .gte("entry_date", periodStart)
      .lte("entry_date", periodEnd)
      .order("entry_date", { ascending: false });

    // 6. Tasks completed
    const { data: tasks } = await supabase
      .from("onboarding_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("completed_at", { ascending: false });

    // 7. Monthly goals
    const { data: monthlyGoals } = await supabase
      .from("onboarding_monthly_goals")
      .select("*")
      .eq("project_id", projectId)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(12);

    // 8. NPS responses
    const { data: npsResponses } = await supabase
      .from("onboarding_nps_responses")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(5);

    // Process data for analysis
    const formatCurrency = (value: number | null) => {
      if (value === null || value === undefined) return "N/A";
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    };

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    // Calculate KPI summaries per salesperson
    const kpiSummaries = kpis?.map(kpi => {
      const kpiEntries = entries?.filter(e => e.kpi_id === kpi.id) || [];
      const total = kpiEntries.reduce((sum, e) => sum + (e.value || 0), 0);
      
      // Group by salesperson
      const bySalesperson: Record<string, number> = {};
      kpiEntries.forEach(entry => {
        if (!bySalesperson[entry.salesperson_id]) {
          bySalesperson[entry.salesperson_id] = 0;
        }
        bySalesperson[entry.salesperson_id] += entry.value || 0;
      });

      const salespersonResults = Object.entries(bySalesperson).map(([spId, value]) => {
        const sp = salespeople?.find(s => s.id === spId);
        return {
          name: sp?.name || "Desconhecido",
          value,
          percentOfTarget: kpi.target_value > 0 ? (value / kpi.target_value) * 100 : 0,
        };
      }).sort((a, b) => b.value - a.value);

      return {
        kpiName: kpi.name,
        kpiType: kpi.kpi_type,
        periodicity: kpi.periodicity,
        target: kpi.target_value,
        total,
        percentOfTarget: kpi.target_value > 0 ? (total / kpi.target_value) * 100 : 0,
        bySalesperson: salespersonResults,
      };
    }) || [];

    // Calculate individual performance
    const salespersonPerformance = salespeople?.map(sp => {
      const spEntries = entries?.filter(e => e.salesperson_id === sp.id) || [];
      const totalValue = spEntries.reduce((sum, e) => sum + (e.value || 0), 0);
      const entryCount = spEntries.length;
      
      // Get performance per KPI
      const kpiPerformance = kpis?.map(kpi => {
        const kpiEntries = spEntries.filter(e => e.kpi_id === kpi.id);
        const kpiTotal = kpiEntries.reduce((sum, e) => sum + (e.value || 0), 0);
        return {
          kpiName: kpi.name,
          value: kpiTotal,
          target: kpi.target_value,
          percent: kpi.target_value > 0 ? (kpiTotal / kpi.target_value) * 100 : 0,
        };
      }) || [];

      return {
        name: sp.name,
        totalValue,
        entryCount,
        kpiPerformance,
      };
    }) || [];

    // Tasks summary
    const completedTasks = tasks?.filter(t => t.status === "completed").length || 0;
    const totalTasks = tasks?.length || 0;
    const recentCompletedTasks = tasks?.filter(t => t.status === "completed").slice(0, 10) || [];

    // Monthly goals summary
    const goalsContext = monthlyGoals?.map(g => {
      const perf = g.sales_target && g.sales_result ? ((g.sales_result / g.sales_target) * 100).toFixed(1) : "N/A";
      return `- ${monthNames[g.month - 1]}/${g.year}: Meta ${formatCurrency(g.sales_target)} | Resultado ${formatCurrency(g.sales_result)} | Performance: ${perf}%`;
    }).join("\n") || "Nenhum dado de metas registrado";

    // Period label for context
    const analyzedPeriod = periodLabel || "período selecionado";

    // Build the context
    const contextPrompt = `
Você é um consultor comercial sênior especializado em análise de performance de vendas. Analise os dados a seguir e forneça insights estratégicos e acionáveis.

${customPrompt ? `## SOLICITAÇÃO ESPECIAL DO USUÁRIO
${customPrompt}

Considere esta solicitação especial ao fazer sua análise.

` : ''}## PERÍODO ANALISADO
${analyzedPeriod} (${periodStart} a ${periodEnd})

## DADOS DA EMPRESA
- Nome: ${company?.name || "N/A"}
- Segmento: ${company?.segment || "N/A"}
- Principais Desafios: ${company?.main_challenges || "N/A"}
- Metas de Curto Prazo: ${company?.goals_short_term || "N/A"}
- Tamanho do Time de Vendas: ${company?.sales_team_size || "N/A"}
- Ticket Médio: ${company?.average_ticket || "N/A"}
- Taxa de Conversão: ${company?.conversion_rate || "N/A"}

## KPIs CONFIGURADOS E RESULTADOS (${analyzedPeriod})
${kpiSummaries.map(kpi => `
### ${kpi.kpiName} (${kpi.periodicity})
- Meta: ${kpi.kpiType === 'monetary' ? formatCurrency(kpi.target) : kpi.target}
- Total Realizado: ${kpi.kpiType === 'monetary' ? formatCurrency(kpi.total) : kpi.total}
- Atingimento: ${kpi.percentOfTarget.toFixed(1)}%

Ranking por Vendedor:
${kpi.bySalesperson.map((sp, idx) => `${idx + 1}. ${sp.name}: ${kpi.kpiType === 'monetary' ? formatCurrency(sp.value) : sp.value} (${sp.percentOfTarget.toFixed(1)}% da meta)`).join("\n") || "Nenhum dado"}
`).join("\n")}

## PERFORMANCE INDIVIDUAL DOS VENDEDORES
${salespersonPerformance.map(sp => `
### ${sp.name}
- Lançamentos no período: ${sp.entryCount}
${sp.kpiPerformance.map(kp => `- ${kp.kpiName}: ${kp.percent.toFixed(1)}% da meta`).join("\n")}
`).join("\n")}

## METAS DE VENDAS MENSAIS
${goalsContext}

## PROGRESSO DO PROJETO
- Tarefas Concluídas: ${completedTasks}/${totalTasks} (${totalTasks > 0 ? ((completedTasks/totalTasks)*100).toFixed(0) : 0}%)
- Status do Projeto: ${project?.status || "N/A"}
- NPS Atual: ${project?.current_nps ?? "Não avaliado"}

Últimas tarefas concluídas:
${recentCompletedTasks.map(t => `- ${t.title}`).join("\n") || "Nenhuma"}

## NPS RECENTE
${npsResponses?.map(n => `- Nota ${n.score}/10: ${n.feedback || n.what_can_improve || "Sem feedback"}`).join("\n") || "Sem respostas de NPS"}

---

Por favor, forneça uma análise estruturada com as seguintes seções:

## 📊 RESUMO EXECUTIVO
Um parágrafo resumindo a situação geral de performance da empresa.

## 🎯 ANÁLISE DOS KPIs
Para cada KPI, avalie:
- Performance vs meta
- Tendência (melhorando/piorando)
- Principais gargalos

## 👥 ANÁLISE POR VENDEDOR
Para cada vendedor, indique:
- Pontos fortes
- Pontos a melhorar
- Ação específica recomendada

## ⚠️ ALERTAS E PRIORIDADES
Liste os 3-5 pontos mais críticos que precisam de atenção imediata.

## 💡 PLANO DE AÇÃO
Sugira 5 ações práticas e específicas para o consultor implementar com o cliente, ordenadas por impacto.

## 🗣️ ROTEIRO DE CONVERSA
Sugira 3 perguntas estratégicas para o consultor fazer na próxima reunião com o cliente.

Seja direto, prático e orientado a resultados. Use emojis para destacar seções.
`;

    console.log("Calling AI Gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um consultor comercial sênior especializado em análise de performance de vendas. Responda sempre em português brasileiro, de forma clara, objetiva e acionável." },
          { role: "user", content: contextPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("KPI Analysis error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
