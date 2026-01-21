import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        .select("id, title, status, priority, due_date, completed_at")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: false })
        .limit(50);
      tasks = tasksData || [];
    }

    // Fetch recent meetings
    let meetings: any[] = [];
    if (activeProject) {
      const { data: meetingsData } = await supabase
        .from("project_meetings")
        .select("id, title, meeting_date, notes, status")
        .eq("project_id", activeProject.id)
        .order("meeting_date", { ascending: false })
        .limit(10);
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
        .limit(5);
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
        .limit(6);
      monthlyGoals = goalsData || [];
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

    const contextData = {
      company: {
        name: company.name,
        niche: company.niche || company.segment || "Não especificado",
        contractStart: company.contract_start_date,
        contractEnd: company.contract_end_date,
        mrr: company.mrr_value,
        status: company.status,
      },
      project: activeProject ? {
        name: activeProject.product_name,
        status: activeProject.status,
        consultant: activeProject.consultant_staff_id,
        cs: activeProject.cs_staff_id,
      } : null,
      tasks: taskStats,
      recentTasks: tasks.slice(0, 10).map(t => ({ title: t.title, status: t.status, priority: t.priority })),
      meetings: {
        total: meetings.length,
        recent: meetings.slice(0, 3).map(m => ({ title: m.title, date: m.meeting_date, notes: m.notes?.substring(0, 200) })),
      },
      nps: {
        average: avgNps,
        recent: npsResponses.slice(0, 3),
      },
      healthScore: healthScore ? {
        total: healthScore.total_score,
        risk: healthScore.risk_level,
        engagement: healthScore.engagement_score,
        satisfaction: healthScore.satisfaction_score,
      } : null,
      goals: {
        latest: latestGoal ? {
          month: latestGoal.goal_month,
          target: latestGoal.sales_target,
          result: latestGoal.sales_result,
          progress: goalProgress,
        } : null,
      },
    };

    // Build prompt for AI
    const systemPrompt = `Você é um assistente especializado em análise de clientes da Universidade Nacional de Vendas.
Você tem acesso completo aos dados desta empresa e deve responder de forma precisa e útil.
Seja direto, use dados concretos quando disponíveis, e forneça insights acionáveis.

Contexto da empresa:
${JSON.stringify(contextData, null, 2)}`;

    let userPrompt: string;
    if (isChat) {
      userPrompt = message;
    } else {
      userPrompt = `Gere um resumo executivo desta empresa para análise rápida. Inclua:

1. **Resumo Geral**: Uma visão geral da empresa em 2-3 frases
2. **Nicho/Segmento**: Qual é o nicho de atuação
3. **Situação Atual**: Health Score, NPS médio, status geral
4. **Resultados**: Progresso nas metas, principais conquistas
5. **O que foi feito**: Tarefas concluídas, reuniões realizadas
6. **O que falta fazer**: Tarefas pendentes, próximos passos
7. **Pontos de Atenção**: Alertas ou riscos identificados

Seja conciso mas informativo. Use emojis para destacar pontos importantes.`;
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
