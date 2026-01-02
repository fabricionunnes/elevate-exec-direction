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
    const { projectId, companyId, message, history } = await req.json();

    console.log("Received request for project:", projectId, "company:", companyId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all context data
    console.log("Fetching project data...");
    
    // 1. Project info
    const { data: project } = await supabase
      .from("onboarding_projects")
      .select("*")
      .eq("id", projectId)
      .single();

    // 2. Company info (full briefing)
    let company = null;
    if (companyId) {
      const { data: companyData } = await supabase
        .from("onboarding_companies")
        .select(`
          *,
          cs:onboarding_staff!onboarding_companies_cs_id_fkey(name, email, role),
          consultant:onboarding_staff!onboarding_companies_consultant_id_fkey(name, email, role)
        `)
        .eq("id", companyId)
        .single();
      company = companyData;
    }

    // 3. All tasks with status
    const { data: tasks } = await supabase
      .from("onboarding_tasks")
      .select(`
        *,
        assignee:onboarding_users(name, role),
        responsible_staff:onboarding_staff(name, role)
      `)
      .eq("project_id", projectId)
      .order("sort_order");

    // 4. Tickets
    const { data: tickets } = await supabase
      .from("onboarding_tickets")
      .select(`
        *,
        created_by_user:onboarding_users!onboarding_tickets_created_by_fkey(name)
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10);

    // 5. Task comments (recent updates)
    const { data: comments } = await supabase
      .from("onboarding_task_comments")
      .select(`
        *,
        user:onboarding_users(name),
        task:onboarding_tasks(title)
      `)
      .in("task_id", tasks?.map(t => t.id) || [])
      .order("created_at", { ascending: false })
      .limit(20);

    // 6. Documents
    const { data: documents } = await supabase
      .from("onboarding_documents")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20);

    // 7. Project variables
    const productVariables = project?.product_variables || {};

    // 8. Monthly goals (metas de vendas)
    const { data: monthlyGoals } = await supabase
      .from("onboarding_monthly_goals")
      .select("*")
      .eq("project_id", projectId)
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    // 9. Subtasks for in-progress tasks
    const inProgressTaskIds = tasks?.filter(t => t.status === "in_progress").map(t => t.id) || [];
    const { data: subtasks } = await supabase
      .from("onboarding_subtasks")
      .select("*")
      .in("task_id", inProgressTaskIds);

    // 10. Task history (últimas ações)
    const { data: taskHistory } = await supabase
      .from("onboarding_task_history")
      .select(`
        *,
        task:onboarding_tasks(title)
      `)
      .in("task_id", tasks?.map(t => t.id) || [])
      .order("created_at", { ascending: false })
      .limit(30);

    // Build comprehensive context
    const completedTasks = tasks?.filter(t => t.status === "completed") || [];
    const inProgressTasks = tasks?.filter(t => t.status === "in_progress") || [];
    const pendingTasks = tasks?.filter(t => t.status === "pending") || [];

    // Group tasks by phase
    const tasksByPhase: Record<string, any[]> = {};
    tasks?.forEach(task => {
      const phase = task.tags?.[0] || "Sem fase";
      if (!tasksByPhase[phase]) tasksByPhase[phase] = [];
      tasksByPhase[phase].push(task);
    });

    const phasesSummary = Object.entries(tasksByPhase).map(([phase, phaseTasks]) => {
      const completed = phaseTasks.filter(t => t.status === "completed").length;
      const total = phaseTasks.length;
      return `- ${phase}: ${completed}/${total} concluídas (${Math.round((completed/total)*100)}%)`;
    }).join("\n");

    // Process monthly goals for context
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    const historicalGoals = monthlyGoals?.filter(g => g.notes?.includes("históricos")) || [];
    const currentGoals = monthlyGoals?.filter(g => !g.notes?.includes("históricos")) || [];
    
    const formatCurrency = (value: number | null) => {
      if (value === null) return "N/A";
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    };

    // Calculate before/after comparison
    let beforeAfterComparison = "";
    if (historicalGoals.length > 0 && currentGoals.length > 0) {
      const historicalWithBoth = historicalGoals.filter(g => g.sales_target && g.sales_result);
      const currentWithBoth = currentGoals.filter(g => g.sales_target && g.sales_result);
      
      if (historicalWithBoth.length > 0 && currentWithBoth.length > 0) {
        const avgHistoricalTarget = historicalWithBoth.reduce((sum, g) => sum + (g.sales_target || 0), 0) / historicalWithBoth.length;
        const avgHistoricalResult = historicalWithBoth.reduce((sum, g) => sum + (g.sales_result || 0), 0) / historicalWithBoth.length;
        const avgHistoricalPerformance = (avgHistoricalResult / avgHistoricalTarget) * 100;
        
        const avgCurrentTarget = currentWithBoth.reduce((sum, g) => sum + (g.sales_target || 0), 0) / currentWithBoth.length;
        const avgCurrentResult = currentWithBoth.reduce((sum, g) => sum + (g.sales_result || 0), 0) / currentWithBoth.length;
        const avgCurrentPerformance = (avgCurrentResult / avgCurrentTarget) * 100;
        
        const performanceChange = avgCurrentPerformance - avgHistoricalPerformance;
        const resultChange = ((avgCurrentResult - avgHistoricalResult) / avgHistoricalResult) * 100;
        
        beforeAfterComparison = `
### Comparativo ANTES vs DEPOIS do Acompanhamento:
**ANTES (${historicalWithBoth.length} meses):**
- Média de meta: ${formatCurrency(avgHistoricalTarget)}
- Média de resultado: ${formatCurrency(avgHistoricalResult)}
- Performance média: ${avgHistoricalPerformance.toFixed(1)}%

**DEPOIS (${currentWithBoth.length} meses):**
- Média de meta: ${formatCurrency(avgCurrentTarget)}
- Média de resultado: ${formatCurrency(avgCurrentResult)}
- Performance média: ${avgCurrentPerformance.toFixed(1)}%

**EVOLUÇÃO:**
- Variação de performance: ${performanceChange > 0 ? '+' : ''}${performanceChange.toFixed(1)}pp
- Crescimento de faturamento: ${resultChange > 0 ? '+' : ''}${resultChange.toFixed(1)}%
`;
      }
    }

    const goalsContext = `
## METAS DE VENDAS

### Metas Históricas (antes do acompanhamento):
${historicalGoals.length > 0 ? historicalGoals.map(g => {
  const perf = g.sales_target && g.sales_result ? ((g.sales_result / g.sales_target) * 100).toFixed(1) : "N/A";
  return `- ${monthNames[g.month - 1]}/${g.year}: Meta ${formatCurrency(g.sales_target)} | Resultado ${formatCurrency(g.sales_result)} | Performance: ${perf}%`;
}).join("\n") : "Nenhum dado histórico registrado"}

### Metas Atuais (com acompanhamento):
${currentGoals.length > 0 ? currentGoals.map(g => {
  const perf = g.sales_target && g.sales_result ? ((g.sales_result / g.sales_target) * 100).toFixed(1) : "N/A";
  return `- ${monthNames[g.month - 1]}/${g.year}: Meta ${formatCurrency(g.sales_target)} | Resultado ${formatCurrency(g.sales_result)} | Performance: ${perf}%`;
}).join("\n") : "Nenhuma meta atual registrada"}

${beforeAfterComparison}
`;

    // Process subtasks
    const subtasksContext = subtasks && subtasks.length > 0 
      ? `
## SUBTAREFAS EM ANDAMENTO
${inProgressTasks.map(task => {
  const taskSubtasks = subtasks.filter(s => s.task_id === task.id);
  if (taskSubtasks.length === 0) return "";
  const completed = taskSubtasks.filter(s => s.is_completed).length;
  return `### ${task.title} (${completed}/${taskSubtasks.length} subtarefas)
${taskSubtasks.map(s => `- ${s.is_completed ? '✅' : '⬜'} ${s.title}`).join("\n")}`;
}).filter(Boolean).join("\n\n")}
`
      : "";

    // Process task history
    const historyContext = taskHistory && taskHistory.length > 0
      ? `
## HISTÓRICO DE AÇÕES RECENTES
${taskHistory.slice(0, 20).map(h => {
  const date = new Date(h.created_at).toLocaleDateString('pt-BR');
  return `- [${date}] ${h.action} em "${h.task?.title || 'Tarefa'}"${h.field_changed ? `: ${h.field_changed} de "${h.old_value}" para "${h.new_value}"` : ''}`;
}).join("\n")}
`
      : "";

    const contextPrompt = `
Você é um assistente de IA especializado em consultoria comercial e onboarding de clientes da UNV.
Você tem acesso COMPLETO a todas as informações deste projeto e empresa. Use essas informações para responder perguntas de forma precisa e útil.

## INFORMAÇÕES DO PROJETO
- Produto: ${project?.product_name || "N/A"}
- Status: ${project?.status || "N/A"}
- Risco de Churn: ${project?.churn_risk || "Não avaliado"}
- Complexidade: ${project?.project_complexity || "N/A"}
- Canal de Comunicação: ${project?.communication_channel || "N/A"}
- Feedback do Cliente: ${project?.client_feedback || "N/A"}
- Bloqueios Atuais: ${project?.current_blockers || "Nenhum"}

## INFORMAÇÕES DA EMPRESA
${company ? `
- Nome: ${company.name}
- CNPJ: ${company.cnpj || "N/A"}
- Segmento: ${company.segment || "N/A"}
- Website: ${company.website || "N/A"}
- Telefone: ${company.phone || "N/A"}
- Email: ${company.email || "N/A"}
- Endereço: ${company.address || "N/A"}

### Briefing/Descrição da Empresa:
${company.company_description || "N/A"}

### Principais Desafios:
${company.main_challenges || "N/A"}

### Metas de Curto Prazo:
${company.goals_short_term || "N/A"}

### Metas de Longo Prazo:
${company.goals_long_term || "N/A"}

### Público-Alvo:
${company.target_audience || "N/A"}

### Concorrentes:
${company.competitors || "N/A"}

### Datas Importantes:
- Data de Kickoff: ${company.kickoff_date || "N/A"}
- Início do Contrato: ${company.contract_start_date || "N/A"}
- Fim do Contrato: ${company.contract_end_date || "N/A"}
- Valor do Contrato: ${company.contract_value ? `R$ ${company.contract_value}` : "N/A"}

### Equipe Responsável:
- CS: ${company.cs?.name || "Não atribuído"}
- Consultor: ${company.consultant?.name || "Não atribuído"}

### Stakeholders:
${JSON.stringify(company.stakeholders || [], null, 2)}

### Notas Adicionais:
${company.notes || "N/A"}
` : "Informações da empresa não disponíveis"}

## PROGRESSO DO ONBOARDING
Total de Tarefas: ${tasks?.length || 0}
- Concluídas: ${completedTasks.length}
- Em Andamento: ${inProgressTasks.length}
- Pendentes: ${pendingTasks.length}
- Progresso: ${tasks?.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%

### Progresso por Fase:
${phasesSummary}

### Tarefas Concluídas (últimas 10):
${completedTasks.slice(0, 10).map(t => `- ✅ ${t.title}${t.completed_at ? ` (concluída em ${new Date(t.completed_at).toLocaleDateString('pt-BR')})` : ''}`).join("\n") || "Nenhuma"}

### Tarefas em Andamento:
${inProgressTasks.map(t => `- 🔄 ${t.title}${t.responsible_staff?.name ? ` (responsável: ${t.responsible_staff.name})` : ''}${t.due_date ? ` [prazo: ${new Date(t.due_date).toLocaleDateString('pt-BR')}]` : ''}`).join("\n") || "Nenhuma"}

### Tarefas Pendentes (próximas 10):
${pendingTasks.slice(0, 10).map(t => `- ⏳ ${t.title}${t.due_date ? ` (prazo: ${new Date(t.due_date).toLocaleDateString('pt-BR')})` : ''}`).join("\n") || "Nenhuma"}

${subtasksContext}

${goalsContext}

${historyContext}

## ATUALIZAÇÕES RECENTES (Comentários)
${comments?.slice(0, 10).map(c => `- [${new Date(c.created_at).toLocaleDateString('pt-BR')}] ${c.user?.name || 'Usuário'} em "${c.task?.title}": ${c.content.substring(0, 100)}...`).join("\n") || "Nenhum comentário recente"}

## CHAMADOS/TICKETS
${tickets?.map(t => `- [${t.status}] ${t.subject} - ${t.created_by_user?.name || 'Usuário'}`).join("\n") || "Nenhum chamado"}

## DOCUMENTOS ANEXADOS
${documents?.map(d => `- ${d.file_name} (${d.category || 'geral'}) - ${d.description || 'sem descrição'}`).join("\n") || "Nenhum documento"}

## VARIÁVEIS DO PROJETO
${Object.keys(productVariables).length > 0 ? JSON.stringify(productVariables, null, 2) : "Nenhuma variável definida"}

---

INSTRUÇÕES:
1. Responda sempre em português brasileiro
2. Seja preciso e use os dados reais do contexto acima
3. Se perguntarem sobre algo que não está nos dados, informe que não tem essa informação
4. Dê sugestões práticas baseadas no contexto real da empresa
5. Destaque riscos ou pontos de atenção quando relevante
6. Formate suas respostas usando Markdown para melhor legibilidade
7. Seja direto e objetivo, mas amigável
8. Quando perguntarem sobre evolução/crescimento, use os dados de metas históricas vs atuais
9. Ao analisar performance, considere tanto os números absolutos quanto as porcentagens
`;

    // Build messages for AI
    const messages = [
      { role: "system", content: contextPrompt },
      ...(history?.map((h: any) => ({ role: h.role, content: h.content })) || []),
      { role: "user", content: message }
    ];

    console.log("Calling Lovable AI Gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua pergunta.";

    console.log("AI response received successfully");

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in onboarding-ai-chat:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
