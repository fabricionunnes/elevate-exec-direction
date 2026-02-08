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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { companyId, projectId, message } = await req.json();
    const isChat = !!message;

    console.log(`[hotseat-company-summary] Processing request for company: ${companyId}, project: ${projectId}, isChat: ${isChat}`);

    // Fetch company data
    const { data: company } = await supabase
      .from("onboarding_companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (!company) {
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch projects for this company
    const { data: projects } = await supabase
      .from("onboarding_projects")
      .select("*")
      .eq("onboarding_company_id", companyId);

    const activeProject = projectId 
      ? projects?.find(p => p.id === projectId) 
      : projects?.find(p => p.status === "active") || projects?.[0];

    // Fetch tasks
    let tasks: any[] = [];
    if (activeProject) {
      const { data: tasksData } = await supabase
        .from("onboarding_tasks")
        .select("id, title, status, priority, due_date, completed_at, description")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: false })
        .limit(100);
      tasks = tasksData || [];
    }

    // Fetch recent meetings
    let meetings: any[] = [];
    if (activeProject) {
      const { data: meetingsData } = await supabase
        .from("project_meetings")
        .select("id, title, meeting_date, notes, status, live_notes")
        .eq("project_id", activeProject.id)
        .order("meeting_date", { ascending: false })
        .limit(20);
      meetings = meetingsData || [];
    }

    // Fetch NPS responses
    let npsResponses: any[] = [];
    if (activeProject) {
      const { data: npsData } = await supabase
        .from("onboarding_nps_responses")
        .select("score, feedback, created_at")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: false })
        .limit(10);
      npsResponses = npsData || [];
    }

    // Fetch health score
    let healthScore: any = null;
    if (activeProject) {
      const { data: healthData } = await supabase
        .from("client_health_scores")
        .select("*")
        .eq("project_id", activeProject.id)
        .single();
      healthScore = healthData;
    }

    // Fetch monthly goals
    let monthlyGoals: any[] = [];
    if (activeProject) {
      const { data: goalsData } = await supabase
        .from("project_monthly_goals")
        .select("*")
        .eq("project_id", activeProject.id)
        .order("goal_month", { ascending: false })
        .limit(12);
      monthlyGoals = goalsData || [];
    }

    // Fetch KPIs from company_kpis
    let companyKpis: any[] = [];
    const { data: kpisData } = await supabase
      .from("company_kpis")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("is_main_goal", { ascending: false });
    companyKpis = kpisData || [];

    // Fetch KPI entries for the current month
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    let kpiEntries: any[] = [];
    if (companyKpis.length > 0) {
      const kpiIds = companyKpis.map(k => k.id);
      const startOfMonth = `${currentMonth}-01`;
      const { data: entriesData } = await supabase
        .from("kpi_entries")
        .select("*")
        .in("kpi_id", kpiIds)
        .gte("entry_date", startOfMonth)
        .order("entry_date", { ascending: false });
      kpiEntries = entriesData || [];
    }

    // Fetch KPI monthly targets
    let kpiMonthlyTargets: any[] = [];
    if (companyKpis.length > 0) {
      const kpiIds = companyKpis.map(k => k.id);
      const { data: targetsData } = await supabase
        .from("kpi_monthly_targets")
        .select("*")
        .in("kpi_id", kpiIds)
        .eq("month_year", currentMonth);
      kpiMonthlyTargets = targetsData || [];
    }

    // Fetch financial data - receivables
    let receivables: any[] = [];
    if (activeProject) {
      const { data: recData } = await supabase
        .from("client_financial_receivables")
        .select("id, client_name, amount, due_date, status, paid_amount")
        .eq("project_id", activeProject.id)
        .order("due_date", { ascending: false })
        .limit(20);
      receivables = recData || [];
    }

    // Fetch financial data - payables
    let payables: any[] = [];
    if (activeProject) {
      const { data: payData } = await supabase
        .from("client_financial_payables")
        .select("id, supplier_name, amount, due_date, status, paid_amount")
        .eq("project_id", activeProject.id)
        .order("due_date", { ascending: false })
        .limit(20);
      payables = payData || [];
    }

    // Fetch staff info for context
    let consultantName = null;
    let csName = null;
    if (activeProject?.consultant_staff_id) {
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("name")
        .eq("id", activeProject.consultant_staff_id)
        .single();
      consultantName = staffData?.name;
    }
    if (activeProject?.cs_staff_id) {
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("name")
        .eq("id", activeProject.cs_staff_id)
        .single();
      csName = staffData?.name;
    }

    // Fetch hotseat history for this company
    let hotseatHistory: any[] = [];
    const { data: hotseatData } = await supabase
      .from("hotseat_responses")
      .select("id, subjects, description, status, scheduled_at, created_at")
      .eq("linked_company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(10);
    hotseatHistory = hotseatData || [];

    // Fetch churn prediction for the project
    let churnPrediction: any = null;
    if (activeProject) {
      const today = new Date().toISOString().split('T')[0];
      const { data: churnData } = await supabase
        .from("churn_predictions")
        .select("*")
        .eq("project_id", activeProject.id)
        .eq("prediction_date", today)
        .maybeSingle();
      churnPrediction = churnData;
    }

    // Fetch retention actions (rescue playbooks)
    let rescuePlaybooks: any[] = [];
    if (activeProject) {
      const { data: rescueData } = await supabase
        .from("rescue_playbooks")
        .select("id, status, created_at, started_at, completed_at")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: false })
        .limit(5);
      rescuePlaybooks = rescueData || [];
    }

    // Build context
    const taskStats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === "completed").length,
      pending: tasks.filter(t => t.status === "pending").length,
      inProgress: tasks.filter(t => t.status === "in_progress").length,
      overdue: tasks.filter(t => t.status !== "completed" && t.due_date && new Date(t.due_date) < new Date()).length,
    };

    const avgNps = npsResponses.length > 0 
      ? npsResponses.reduce((sum, n) => sum + n.score, 0) / npsResponses.length 
      : null;

    const latestGoal = monthlyGoals[0];
    const goalProgress = latestGoal?.sales_target && latestGoal?.sales_result
      ? Math.round((latestGoal.sales_result / latestGoal.sales_target) * 100)
      : null;

    // Calculate KPI summaries
    const mainGoalKpis = companyKpis.filter(k => k.is_main_goal);
    const kpiSummaries = companyKpis.map(kpi => {
      const entries = kpiEntries.filter(e => e.kpi_id === kpi.id);
      const totalValue = entries.reduce((sum, e) => sum + (e.value || 0), 0);
      const monthlyTarget = kpiMonthlyTargets.find(t => t.kpi_id === kpi.id);
      const target = monthlyTarget?.target_value || kpi.target_value;
      const progress = target > 0 ? Math.round((totalValue / target) * 100) : 0;
      return {
        name: kpi.name,
        type: kpi.kpi_type,
        isMainGoal: kpi.is_main_goal,
        target,
        currentValue: totalValue,
        progress,
        periodicity: kpi.periodicity,
        scope: kpi.scope,
      };
    });

    // Financial summaries
    const financialSummary = {
      receivables: {
        total: receivables.length,
        pending: receivables.filter(r => r.status === "pending").length,
        overdue: receivables.filter(r => r.status === "pending" && new Date(r.due_date) < new Date()).length,
        totalAmount: receivables.reduce((sum, r) => sum + (r.amount || 0), 0),
        paidAmount: receivables.reduce((sum, r) => sum + (r.paid_amount || 0), 0),
      },
      payables: {
        total: payables.length,
        pending: payables.filter(p => p.status === "pending").length,
        overdue: payables.filter(p => p.status === "pending" && new Date(p.due_date) < new Date()).length,
        totalAmount: payables.reduce((sum, p) => sum + (p.amount || 0), 0),
        paidAmount: payables.reduce((sum, p) => sum + (p.paid_amount || 0), 0),
      },
    };

    const contextData = {
      company: {
        name: company.name,
        niche: company.niche || company.segment || "Não especificado",
        contractStart: company.contract_start_date,
        contractEnd: company.contract_end_date,
        mrr: company.mrr_value,
        status: company.status,
        notes: company.notes,
        paymentMethod: company.payment_method,
        isRecurring: company.payment_method === "monthly",
      },
      project: activeProject ? {
        name: activeProject.product_name,
        status: activeProject.status,
        consultant: consultantName,
        cs: csName,
        startDate: activeProject.start_date,
        expectedEndDate: activeProject.expected_end_date,
      } : null,
      tasks: taskStats,
      recentTasks: tasks.slice(0, 15).map(t => ({ 
        title: t.title, 
        status: t.status, 
        priority: t.priority,
        dueDate: t.due_date,
      })),
      highPriorityTasks: tasks.filter(t => t.priority === "high" && t.status !== "completed").slice(0, 10).map(t => ({
        title: t.title,
        status: t.status,
        dueDate: t.due_date,
      })),
      meetings: {
        total: meetings.length,
        completed: meetings.filter(m => m.status === "completed").length,
        scheduled: meetings.filter(m => m.status === "scheduled").length,
        recent: meetings.slice(0, 5).map(m => ({ 
          title: m.title, 
          date: m.meeting_date, 
          status: m.status,
          notes: m.notes?.substring(0, 300),
        })),
      },
      nps: {
        average: avgNps,
        count: npsResponses.length,
        recent: npsResponses.slice(0, 5).map(n => ({
          score: n.score,
          feedback: n.feedback,
          date: n.created_at,
        })),
      },
      healthScore: healthScore ? {
        total: healthScore.total_score,
        risk: healthScore.risk_level,
        engagement: healthScore.engagement_score,
        satisfaction: healthScore.satisfaction_score,
        lastUpdated: healthScore.updated_at,
      } : null,
      monthlyGoals: {
        latest: latestGoal ? {
          month: latestGoal.goal_month,
          salesTarget: latestGoal.sales_target,
          salesResult: latestGoal.sales_result,
          progress: goalProgress,
          projectGoal: latestGoal.project_goal,
          observations: latestGoal.observations,
        } : null,
        history: monthlyGoals.slice(0, 6).map(g => ({
          month: g.goal_month,
          target: g.sales_target,
          result: g.sales_result,
          progress: g.sales_target ? Math.round((g.sales_result || 0) / g.sales_target * 100) : 0,
        })),
      },
      kpis: {
        total: companyKpis.length,
        mainGoals: mainGoalKpis.length,
        summaries: kpiSummaries,
      },
      financial: financialSummary,
      hotseatHistory: hotseatHistory.map(h => ({
        subjects: h.subjects,
        status: h.status,
        scheduledAt: h.scheduled_at,
        createdAt: h.created_at,
      })),
      churnPrediction: churnPrediction ? {
        probability: churnPrediction.churn_probability,
        riskLevel: churnPrediction.risk_level,
        riskWindow: churnPrediction.estimated_risk_window,
        riskFactors: churnPrediction.risk_factors,
        recommendedActions: churnPrediction.recommended_actions,
      } : null,
      retention: {
        hasActivePlaybook: rescuePlaybooks.some(r => r.status === "in_progress"),
        recentlyRetained: rescuePlaybooks.some(r => r.status === "completed" && 
          new Date(r.completed_at) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)),
        playbooks: rescuePlaybooks.map(r => ({
          status: r.status,
          createdAt: r.created_at,
          completedAt: r.completed_at,
        })),
      },
      contractStatus: {
        startDate: company.contract_start_date,
        endDate: company.contract_end_date,
        paymentMethod: company.payment_method,
        isRecurring: company.payment_method === "monthly",
        daysUntilExpiry: company.contract_end_date && company.payment_method !== "monthly" ? 
          Math.ceil((new Date(company.contract_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
        isExpiringSoon: company.contract_end_date && company.payment_method !== "monthly" ? 
          Math.ceil((new Date(company.contract_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 60 : false,
        renewalStatus: company.renewal_status,
        renewalMeetingDate: company.renewal_meeting_date,
      },
    };

    // Build prompt for AI
    const systemPrompt = `Você é um assistente especializado em análise de clientes da Universidade Nacional de Vendas.
Você tem acesso COMPLETO aos dados desta empresa, incluindo:
- Informações da empresa e projeto
- Tarefas (pendentes, concluídas, atrasadas, prioridade alta)
- Reuniões realizadas e agendadas
- NPS e feedback dos clientes
- Health Score e nível de risco
- METAS MENSAIS (monthly goals) com target e resultado
- KPIs configurados com metas e progresso atual
- Dados financeiros (contas a receber e pagar)
- Histórico de Hotseats
- PREDIÇÃO DE CHURN com probabilidade e fatores de risco
- STATUS DE RENOVAÇÃO do contrato
- HISTÓRICO DE RETENÇÃO (playbooks de resgate)

IMPORTANTE:
- Sempre responda com base nos dados fornecidos no contexto
- Se perguntarem sobre metas, use os dados de "monthlyGoals" e "kpis"
- Se perguntarem sobre tarefas, use "tasks" e "recentTasks"
- Se perguntarem sobre reuniões, use "meetings"
- Se perguntarem sobre saúde/risco, use "healthScore" e "churnPrediction"
- Se perguntarem sobre renovação, use "contractStatus"
- Seja preciso e use números concretos dos dados
- Se um dado não estiver disponível, diga claramente que não há registro

Contexto da empresa:
${JSON.stringify(contextData, null, 2)}`;

    let userPrompt: string;
    if (isChat) {
      userPrompt = message;
    } else {
      userPrompt = `Gere um resumo ESTRUTURADO desta empresa (máximo 250 palavras) usando emojis e formatação markdown para destacar informações importantes. Siga este formato:

## 📊 Visão Geral
• **Nicho**: [segmento]
• **Health Score**: [score]/100 | **NPS**: [valor ou N/A]
• **Consultor**: [nome] | **CS**: [nome]

## ⚠️ Alertas Importantes
[Liste APENAS se houver algum destes casos - use emojis de alerta 🔴🟡🟢:]
- Se contractStatus.isRecurring = true: "📋 Contrato Recorrente" (NÃO mencione vencimento)
- 🔴 Se churn_probability > 60%: "RISCO ALTO DE CHURN: X% de probabilidade"
- 🔴 Se contrato NÃO é recorrente E expira em ≤30 dias: "CONTRATO EXPIRA EM X DIAS!"
- 🟡 Se contrato NÃO é recorrente E expira em ≤60 dias: "Renovação próxima: X dias"
- 🟢 Se foi retido recentemente: "Cliente RETIDO recentemente ✓"
- 🟡 Se health score < 60: "Saúde do cliente baixa"
- 🟡 Se NPS < 7: "NPS precisa de atenção"

## 📈 Metas e KPIs
• Meta principal: [nome] - [progresso]% do target
• Tendência: [subindo/descendo/estável]

## ✅ Tarefas
• [X] concluídas | [Y] pendentes | [Z] atrasadas

## 🎯 Próximos Passos
1. [Ação prioritária 1]
2. [Ação prioritária 2]
3. [Ação prioritária 3]

REGRAS:
- Use cores através de emojis (🔴 crítico, 🟡 atenção, 🟢 ok)
- Seja direto e objetivo
- Destaque números importantes com **negrito**
- Omita seções se não houver dados relevantes`;
    }

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("[hotseat-company-summary] AI error:", aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "Não foi possível gerar o resumo.";

    console.log(`[hotseat-company-summary] Successfully generated ${isChat ? 'chat response' : 'summary'}`);

    return new Response(JSON.stringify({ 
      content,
      context: contextData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal error";
    console.error("[hotseat-company-summary] Error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
