import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em Customer Success e análise de saúde de clientes.

Seu papel é analisar os dados de um projeto/cliente e fornecer:
1. **Diagnóstico Geral**: Uma visão clara do estado atual da saúde do cliente
2. **Pontos Críticos**: Áreas que precisam de atenção imediata
3. **Oportunidades**: Onde há potencial de melhoria
4. **Plano de Ação**: 3-5 ações concretas e prioritizadas para melhorar a saúde do cliente
5. **Previsão de Churn**: Avaliação de risco baseada nos dados

REGRAS:
- Seja direto e objetivo
- Use bullet points para facilitar a leitura
- Priorize ações por impacto
- Base suas recomendações nos dados fornecidos
- Use emojis para destacar pontos importantes (⚠️ para alertas, ✅ para positivos, 🎯 para ações)
- Sempre considere o contexto do briefing quando disponível
- Formate a resposta em Markdown`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch project and company data
    const { data: project, error: projectError } = await supabase
      .from("onboarding_projects")
      .select(`
        *,
        onboarding_company:onboarding_companies(*)
      `)
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      throw new Error("Project not found");
    }

    const companyId = project.onboarding_company_id;

    // Fetch health score
    const { data: healthScore } = await supabase
      .from("client_health_scores")
      .select("*")
      .eq("project_id", projectId)
      .single();

    // Fetch NPS responses
    const { data: npsResponses } = await supabase
      .from("onboarding_nps_responses")
      .select("score, justification, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch CSAT responses
    const { data: csatResponses } = await supabase
      .from("csat_responses")
      .select("score, feedback, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch tasks with more details
    const { data: tasks } = await supabase
      .from("onboarding_tasks")
      .select("id, title, status, due_date, completed_at, priority, observations, description")
      .eq("project_id", projectId);

    // Fetch task attachments/documents
    const { data: taskDocuments } = await supabase
      .from("onboarding_documents")
      .select("task_id, file_name, file_type, file_size")
      .eq("project_id", projectId)
      .not("task_id", "is", null);

    // Fetch tickets
    const { data: tickets } = await supabase
      .from("onboarding_tickets")
      .select("subject, status, priority, created_at")
      .eq("project_id", projectId);

    // Fetch monthly goals
    const { data: monthlyGoals } = await supabase
      .from("onboarding_monthly_goals")
      .select("month, year, sales_target, sales_result")
      .eq("project_id", projectId)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(6);

    // Fetch meetings
    const { data: meetings } = await supabase
      .from("onboarding_meeting_notes")
      .select("meeting_date, meeting_type, attended")
      .eq("project_id", projectId)
      .order("meeting_date", { ascending: false })
      .limit(10);

    // Group attachments by task_id
    const attachmentsByTask: Record<string, Array<{file_name: string, file_type: string}>> = {};
    taskDocuments?.forEach(doc => {
      if (doc.task_id) {
        if (!attachmentsByTask[doc.task_id]) {
          attachmentsByTask[doc.task_id] = [];
        }
        attachmentsByTask[doc.task_id].push({ file_name: doc.file_name, file_type: doc.file_type });
      }
    });

    // Calculate task statistics
    const taskStats = {
      total: tasks?.length || 0,
      completed: tasks?.filter(t => t.status === "completed").length || 0,
      overdue: tasks?.filter(t => 
        t.status !== "completed" && 
        t.due_date && 
        new Date(t.due_date) < new Date()
      ).length || 0,
      pending: tasks?.filter(t => t.status === "pending").length || 0,
    };

    // Build detailed task list with observations and attachments
    const detailedTasks = tasks?.map(t => {
      const attachments = attachmentsByTask[t.id] || [];
      return {
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        description: t.description,
        observations: t.observations,
        attachments: attachments.map(a => `${a.file_name} (${a.file_type})`),
      };
    });

    // Calculate goal achievement
    const goalAchievement = monthlyGoals?.filter(g => g.sales_target && g.sales_target > 0).map(g => ({
      month: `${g.month}/${g.year}`,
      target: g.sales_target,
      result: g.sales_result || 0,
      percentage: g.sales_target ? Math.round(((g.sales_result || 0) / g.sales_target) * 100) : 0
    }));

    // Build context prompt
    const contextPrompt = `
## DADOS DO CLIENTE

### Informações da Empresa
- **Nome**: ${project.onboarding_company?.name || "N/A"}
- **Segmento**: ${project.onboarding_company?.segment || "N/A"}
- **Tamanho do Time**: ${project.onboarding_company?.team_size || "N/A"}
- **Faturamento**: ${project.onboarding_company?.revenue || "N/A"}
- **Data de Início**: ${project.start_date || "N/A"}
- **Status do Projeto**: ${project.status || "N/A"}

### Briefing/Contexto
${project.onboarding_company?.briefing || project.briefing || "Não disponível"}

### Health Score Atual
- **Score Total**: ${healthScore?.total_score || "Não calculado"}/100
- **Nível de Risco**: ${healthScore?.risk_level || "N/A"}
- **Tendência**: ${healthScore?.trend_direction || "N/A"}
- **Satisfação**: ${healthScore?.satisfaction_score || 0}/100
- **Metas**: ${healthScore?.goals_score || 0}/100
- **Comercial**: ${healthScore?.commercial_score || 0}/100
- **Engajamento**: ${healthScore?.engagement_score || 0}/100
- **Suporte**: ${healthScore?.support_score || 0}/100

### NPS (últimas respostas)
${npsResponses?.map(n => `- Score ${n.score}: "${n.justification || 'Sem comentário'}"`).join("\n") || "Sem respostas"}

### CSAT (últimas respostas)
${csatResponses?.map(c => `- Score ${c.score}/5: "${c.feedback || 'Sem feedback'}"`).join("\n") || "Sem respostas"}

### Tarefas (Resumo)
- Total: ${taskStats.total}
- Concluídas: ${taskStats.completed} (${taskStats.total > 0 ? Math.round((taskStats.completed/taskStats.total)*100) : 0}%)
- Atrasadas: ${taskStats.overdue}
- Pendentes: ${taskStats.pending}

### Tarefas Detalhadas (com observações e anexos)
${detailedTasks?.filter(t => t.observations || t.attachments.length > 0 || t.status !== "completed").slice(0, 20).map(t => {
  let taskInfo = `- **${t.title}** [${t.status}${t.priority ? `, ${t.priority}` : ""}]`;
  if (t.description) taskInfo += `\n  Descrição: ${t.description.substring(0, 200)}${t.description.length > 200 ? "..." : ""}`;
  if (t.observations) taskInfo += `\n  Observações: ${t.observations.substring(0, 300)}${t.observations.length > 300 ? "..." : ""}`;
  if (t.attachments.length > 0) taskInfo += `\n  Anexos: ${t.attachments.join(", ")}`;
  return taskInfo;
}).join("\n") || "Sem tarefas com detalhes relevantes"}

### Tickets de Suporte
${tickets?.length ? tickets.map(t => `- [${t.status}] ${t.subject}`).join("\n") : "Sem tickets"}

### Metas Mensais
${goalAchievement?.length ? goalAchievement.map(g => `- ${g.month}: ${g.percentage}% da meta (R$ ${g.result?.toLocaleString()} / R$ ${g.target?.toLocaleString()})`).join("\n") : "Sem histórico de metas"}

### Reuniões Recentes
${meetings?.length ? meetings.map(m => `- ${m.meeting_date}: ${m.meeting_type} (${m.attended ? 'Compareceu' : 'Faltou'})`).join("\n") : "Sem histórico de reuniões"}

---

Com base nesses dados, forneça uma análise completa da saúde do cliente com diagnóstico, pontos críticos, oportunidades e plano de ação.
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contextPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: unknown) {
    console.error("Error in health-analysis:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
