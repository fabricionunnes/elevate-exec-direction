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
          cs:onboarding_staff!onboarding_companies_cs_id_fkey(name, email, role, phone),
          consultant:onboarding_staff!onboarding_companies_consultant_id_fkey(name, email, role, phone)
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
        assignee:onboarding_users(name, role, email),
        responsible_staff:onboarding_staff(name, role, email)
      `)
      .eq("project_id", projectId)
      .order("sort_order");

    // 3b. Fetch task attachments (documents linked to specific tasks)
    const { data: taskAttachments } = await supabase
      .from("onboarding_documents")
      .select("*")
      .eq("project_id", projectId)
      .not("task_id", "is", null);
    
    // Group attachments by task_id for easy lookup
    const attachmentsByTaskId: Record<string, any[]> = {};
    taskAttachments?.forEach(doc => {
      if (doc.task_id) {
        if (!attachmentsByTaskId[doc.task_id]) {
          attachmentsByTaskId[doc.task_id] = [];
        }
        attachmentsByTaskId[doc.task_id].push(doc);
      }
    });

    // 4. Tickets with replies
    const { data: tickets } = await supabase
      .from("onboarding_tickets")
      .select(`
        *,
        created_by_user:onboarding_users!onboarding_tickets_created_by_fkey(name, email),
        assigned_to_user:onboarding_users!onboarding_tickets_assigned_to_fkey(name)
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20);

    // 4b. Ticket replies for recent tickets
    const ticketIds = tickets?.map(t => t.id) || [];
    const { data: ticketReplies } = await supabase
      .from("onboarding_ticket_replies")
      .select(`
        *,
        user:onboarding_users(name)
      `)
      .in("ticket_id", ticketIds)
      .order("created_at", { ascending: false })
      .limit(50);

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
      .limit(30);

    // 6. Documents (metadata)
    const { data: documents } = await supabase
      .from("onboarding_documents")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(30);

    // 6b. Fetch text content from readable documents (PDFs, text files)
    console.log("Fetching document contents...");
    const readableDocuments: { name: string; category: string; content: string; taskTitle?: string }[] = [];
    
    // Helper function to read file content
    const readFileContent = async (doc: any, taskTitle?: string): Promise<{ name: string; category: string; content: string; taskTitle?: string } | null> => {
      try {
        const fileType = doc.file_type?.toLowerCase() || '';
        const fileName = doc.file_name?.toLowerCase() || '';
        
        // Check if it's a readable text format
        const isTextFile = fileType.includes('text') || 
                          fileName.endsWith('.txt') || 
                          fileName.endsWith('.md') ||
                          fileName.endsWith('.csv') ||
                          fileName.endsWith('.json');
        
        if (!isTextFile) {
          // For non-text files (PDFs, images, etc.), return metadata only
          return {
            name: doc.file_name,
            category: doc.category || 'geral',
            content: `[Arquivo: ${doc.file_name}] ${doc.description || 'Sem descrição'}`,
            taskTitle
          };
        }
        
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("onboarding-documents")
          .download(doc.file_path);
        
        if (downloadError) {
          console.error(`Error downloading ${doc.file_name}:`, downloadError);
          return null;
        }
        
        const textContent = await fileData.text();
        
        if (textContent && textContent.length > 0) {
          return {
            name: doc.file_name,
            category: doc.category || 'geral',
            content: textContent.substring(0, 8000), // Limit per doc
            taskTitle
          };
        }
        return null;
      } catch (docError) {
        console.error(`Error processing ${doc.file_name}:`, docError);
        return null;
      }
    };
    
    // Process company documents (limit to 5)
    if (documents && documents.length > 0) {
      const docsToProcess = documents.slice(0, 5);
      const results = await Promise.all(docsToProcess.map(doc => readFileContent(doc)));
      results.filter(Boolean).forEach(r => r && readableDocuments.push(r));
    }
    
    // Process task attachments (prioritize recent tasks with attachments)
    console.log("Fetching task attachment contents...");
    const taskAttachmentContents: { taskId: string; taskTitle: string; attachments: { name: string; content: string }[] }[] = [];
    
    if (taskAttachments && taskAttachments.length > 0) {
      // Get unique task IDs with attachments
      const taskIdsWithAttachments = [...new Set(taskAttachments.map(a => a.task_id))].slice(0, 10);
      
      for (const taskId of taskIdsWithAttachments) {
        const task = tasks?.find(t => t.id === taskId);
        if (!task) continue;
        
        const attachmentsForTask = taskAttachments.filter(a => a.task_id === taskId).slice(0, 3);
        const taskAttachmentResults: { name: string; content: string }[] = [];
        
        for (const attachment of attachmentsForTask) {
          const result = await readFileContent(attachment, task.title);
          if (result) {
            taskAttachmentResults.push({
              name: result.name,
              content: result.content
            });
          }
        }
        
        if (taskAttachmentResults.length > 0) {
          taskAttachmentContents.push({
            taskId,
            taskTitle: task.title,
            attachments: taskAttachmentResults
          });
        }
      }
    }
    
    console.log(`Loaded content from ${readableDocuments.length} Supabase documents and ${taskAttachmentContents.length} tasks with attachments`);

    // 6c. Fetch documents from Google Drive (if connected)
    console.log("Checking for Google Drive documents...");
    let driveDocuments: { name: string; content: string; type: string }[] = [];
    
    if (project?.documents_link) {
      try {
        // Check if Drive is connected
        const { data: driveToken } = await supabase
          .from("google_drive_tokens")
          .select("expires_at")
          .eq("project_id", projectId)
          .single();
        
        if (driveToken) {
          // Call the google-drive-files function to get document content
          const driveResponse = await fetch(
            `${supabaseUrl}/functions/v1/google-drive-files`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                projectId,
                action: "context"
              }),
            }
          );
          
          if (driveResponse.ok) {
            const driveData = await driveResponse.json();
            if (driveData.documents && driveData.documents.length > 0) {
              driveDocuments = driveData.documents;
              console.log(`Loaded content from ${driveDocuments.length} Google Drive documents`);
            }
          } else {
            console.log("Failed to fetch Drive documents:", await driveResponse.text());
          }
        } else {
          console.log("Google Drive not connected for this project");
        }
      } catch (driveError) {
        console.error("Error fetching Drive documents:", driveError);
      }
    }

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
        task:onboarding_tasks(title),
        staff:onboarding_staff(name),
        user:onboarding_users(name)
      `)
      .in("task_id", tasks?.map(t => t.id) || [])
      .order("created_at", { ascending: false })
      .limit(40);

    // 11. NPS Responses
    const { data: npsResponses } = await supabase
      .from("onboarding_nps_responses")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    // 12. Onboarding Users (contacts/users from this project)
    const { data: onboardingUsers } = await supabase
      .from("onboarding_users")
      .select("*")
      .eq("project_id", projectId);

    // 13. All projects from this company (to see other services)
    const { data: companyProjects } = await supabase
      .from("onboarding_projects")
      .select("id, product_name, status, created_at, churn_risk, current_nps")
      .eq("onboarding_company_id", companyId);

    // 14. Notifications related to this project
    const { data: notifications } = await supabase
      .from("onboarding_notifications")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20);

    // 15. Meeting notes (O que foi tratado nas reuniões)
    const { data: meetingNotes } = await supabase
      .from("onboarding_meeting_notes")
      .select("*")
      .eq("project_id", projectId)
      .order("meeting_date", { ascending: false })
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
${taskHistory.slice(0, 30).map(h => {
  const date = new Date(h.created_at).toLocaleDateString('pt-BR');
  const actor = h.staff?.name || h.user?.name || 'Sistema';
  return `- [${date}] ${actor}: ${h.action} em "${h.task?.title || 'Tarefa'}"${h.field_changed ? `: ${h.field_changed} de "${h.old_value}" para "${h.new_value}"` : ''}`;
}).join("\n")}
`
      : "";

    // NPS Context
    const npsContext = npsResponses && npsResponses.length > 0
      ? `
## PESQUISAS NPS
### Resumo:
- Total de respostas: ${npsResponses.length}
- NPS atual do projeto: ${project?.current_nps ?? 'N/A'}
- Média das notas: ${(npsResponses.reduce((sum, r) => sum + r.score, 0) / npsResponses.length).toFixed(1)}

### Respostas detalhadas:
${npsResponses.map(r => {
  const date = new Date(r.created_at).toLocaleDateString('pt-BR');
  const category = r.score >= 9 ? 'Promotor' : r.score >= 7 ? 'Neutro' : 'Detrator';
  return `- [${date}] ${r.respondent_name || 'Anônimo'} - Nota: ${r.score}/10 (${category})
  ${r.feedback ? `  Feedback: ${r.feedback}` : ''}
  ${r.would_recommend_why ? `  Por que recomendaria: ${r.would_recommend_why}` : ''}
  ${r.what_can_improve ? `  O que pode melhorar: ${r.what_can_improve}` : ''}`;
}).join("\n")}
`
      : "";

    // Users/Contacts Context
    const usersContext = onboardingUsers && onboardingUsers.length > 0
      ? `
## USUÁRIOS/CONTATOS DO PROJETO
${onboardingUsers.map(u => `- ${u.name} (${u.role}) - ${u.email}`).join("\n")}
`
      : "";

    // Other projects context
    const otherProjectsContext = companyProjects && companyProjects.length > 1
      ? `
## OUTROS SERVIÇOS CONTRATADOS PELA EMPRESA
${companyProjects.filter(p => p.id !== projectId).map(p => {
  return `- ${p.product_name}: Status ${p.status}${p.churn_risk ? ` | Risco: ${p.churn_risk}` : ''}${p.current_nps ? ` | NPS: ${p.current_nps}` : ''}`;
}).join("\n")}
`
      : "";

    // Tickets with replies context
    const ticketsContext = tickets && tickets.length > 0
      ? `
## CHAMADOS/TICKETS DETALHADOS
${tickets.map(t => {
  const replies = ticketReplies?.filter(r => r.ticket_id === t.id) || [];
  return `### [${t.status.toUpperCase()}] ${t.subject}
- Criado por: ${t.created_by_user?.name || 'Usuário'} em ${new Date(t.created_at).toLocaleDateString('pt-BR')}
- Mensagem: ${t.message.substring(0, 200)}${t.message.length > 200 ? '...' : ''}
${replies.length > 0 ? `- Respostas (${replies.length}):
${replies.slice(0, 3).map(r => `  - ${r.user?.name || 'Usuário'}: ${r.message.substring(0, 100)}...`).join("\n")}` : '- Sem respostas ainda'}`;
}).join("\n\n")}
`
      : "## CHAMADOS/TICKETS\nNenhum chamado registrado";

    // Notifications context
    const notificationsContext = notifications && notifications.length > 0
      ? `
## NOTIFICAÇÕES RECENTES
${notifications.slice(0, 10).map(n => {
  const date = new Date(n.created_at).toLocaleDateString('pt-BR');
  return `- [${date}] ${n.title}: ${n.message}${n.is_read ? '' : ' (não lida)'}`;
}).join("\n")}
`
      : "";

    // Meetings context (critical for understanding what was discussed)
    // Include FULL transcript and manual_transcript content
    const meetingsContext = meetingNotes && meetingNotes.length > 0
      ? `
## REUNIÕES REALIZADAS (O que foi tratado + Transcrições)
${meetingNotes.filter(m => m.is_finalized).map(m => {
  const date = new Date(m.meeting_date).toLocaleDateString('pt-BR');
  const transcriptText = m.transcript || m.manual_transcript || null;
  return `### ${m.meeting_title || 'Reunião'} - ${date}
**Participantes:** ${m.attendees || 'Não informados'}
${m.notes ? `**O que foi tratado:**
${m.notes}` : ''}
${transcriptText ? `**TRANSCRIÇÃO DA REUNIÃO:**
${transcriptText.substring(0, 8000)}${transcriptText.length > 8000 ? '... [transcrição truncada para contexto]' : ''}` : ''}
`;
}).join("\n---\n")}
`
      : "## REUNIÕES\nNenhuma reunião finalizada";

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
- NPS Atual: ${project?.current_nps ?? "N/A"}
- Dependência do Cliente: ${project?.client_dependency || "N/A"}

## INFORMAÇÕES DA EMPRESA
${company ? `
- Nome: ${company.name}
- CNPJ: ${company.cnpj || "N/A"}
- Segmento: ${company.segment || "N/A"}
- Website: ${company.website || "N/A"}
- Telefone: ${company.phone || "N/A"}
- Email: ${company.email || "N/A"}
- Endereço: ${company.address || "N/A"}
- Status da Empresa: ${company.status || "N/A"}

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
- Dia de Faturamento: ${company.billing_day || "N/A"}

### Equipe Responsável:
- CS: ${company.cs?.name || "Não atribuído"} ${company.cs?.email ? `(${company.cs.email})` : ''} ${company.cs?.phone ? `- ${company.cs.phone}` : ''}
- Consultor: ${company.consultant?.name || "Não atribuído"} ${company.consultant?.email ? `(${company.consultant.email})` : ''} ${company.consultant?.phone ? `- ${company.consultant.phone}` : ''}

### Stakeholders:
${JSON.stringify(company.stakeholders || [], null, 2)}

### Cronograma Esperado:
${JSON.stringify(company.expected_timeline || [], null, 2)}

### Notas Adicionais:
${company.notes || "N/A"}
` : "Informações da empresa não disponíveis"}

${usersContext}

${otherProjectsContext}

## PROGRESSO DO ONBOARDING
Total de Tarefas: ${tasks?.length || 0}
- Concluídas: ${completedTasks.length}
- Em Andamento: ${inProgressTasks.length}
- Pendentes: ${pendingTasks.length}
- Progresso: ${tasks?.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%

### Progresso por Fase:
${phasesSummary}

### Tarefas Concluídas (últimas 15):
${completedTasks.slice(0, 15).map(t => `- ✅ ${t.title}${t.completed_at ? ` (concluída em ${new Date(t.completed_at).toLocaleDateString('pt-BR')})` : ''}${t.responsible_staff?.name ? ` por ${t.responsible_staff.name}` : ''}`).join("\n") || "Nenhuma"}

### Tarefas em Andamento:
${inProgressTasks.map(t => `- 🔄 ${t.title}${t.responsible_staff?.name ? ` (responsável: ${t.responsible_staff.name})` : ''}${t.due_date ? ` [prazo: ${new Date(t.due_date).toLocaleDateString('pt-BR')}]` : ''}${t.description ? `\n  Descrição: ${t.description.substring(0, 150)}...` : ''}`).join("\n") || "Nenhuma"}

### Tarefas Pendentes (próximas 15):
${pendingTasks.slice(0, 15).map(t => `- ⏳ ${t.title}${t.due_date ? ` (prazo: ${new Date(t.due_date).toLocaleDateString('pt-BR')})` : ''}${t.priority ? ` [${t.priority}]` : ''}`).join("\n") || "Nenhuma"}

### Tarefas Atrasadas:
${tasks?.filter(t => t.status !== "completed" && t.due_date && new Date(t.due_date) < new Date()).map(t => `- ⚠️ ${t.title} (venceu em ${new Date(t.due_date!).toLocaleDateString('pt-BR')})`).join("\n") || "Nenhuma tarefa atrasada"}

${subtasksContext}

${goalsContext}

${npsContext}

${historyContext}

## ATUALIZAÇÕES RECENTES (Comentários)
${comments?.slice(0, 15).map(c => `- [${new Date(c.created_at).toLocaleDateString('pt-BR')}] ${c.user?.name || 'Usuário'} em "${c.task?.title}": ${c.content.substring(0, 150)}...`).join("\n") || "Nenhum comentário recente"}

${meetingsContext}

## DOCUMENTOS ANEXADOS
${documents?.map(d => `- ${d.file_name} (${d.category || 'geral'}) - ${d.description || 'sem descrição'} [${new Date(d.created_at).toLocaleDateString('pt-BR')}]`).join("\n") || "Nenhum documento"}

${readableDocuments.length > 0 ? `
## CONTEÚDO DOS DOCUMENTOS (Upload no Projeto)
Os seguintes documentos foram lidos e seu conteúdo está disponível para consulta:

${readableDocuments.map(d => `### 📄 ${d.name} (${d.category})
\`\`\`
${d.content}
\`\`\`
`).join("\n")}
` : ''}

${driveDocuments.length > 0 ? `
## DOCUMENTOS DO GOOGLE DRIVE
Os seguintes documentos foram lidos da pasta Google Drive vinculada ao projeto:

${driveDocuments.map(d => `### 📄 ${d.name} (${d.type})
\`\`\`
${d.content}
\`\`\`
`).join("\n")}
` : ''}

${taskAttachmentContents.length > 0 ? `
## ANEXOS DE TAREFAS (Arquivos vinculados a tarefas específicas)
Os seguintes arquivos estão anexados às tarefas e seu conteúdo foi lido:

${taskAttachmentContents.map(t => `### 📎 Tarefa: "${t.taskTitle}"
${t.attachments.map(a => `#### ${a.name}
\`\`\`
${a.content}
\`\`\`
`).join("\n")}`).join("\n")}
` : ''}

## VARIÁVEIS DO PROJETO
${Object.keys(productVariables).length > 0 ? JSON.stringify(productVariables, null, 2) : "Nenhuma variável definida"}

---

INSTRUÇÕES:
1. Responda sempre em português brasileiro
2. Seja preciso e use os dados reais do contexto acima
3. Se perguntarem sobre algo que não está nos dados, informe que não tem essa informação
4. Dê sugestões práticas baseadas no contexto real da empresa
5. Destaque riscos ou pontos de atenção quando relevante (tarefas atrasadas, NPS baixo, tickets abertos, etc)
6. Formate suas respostas usando Markdown para melhor legibilidade
7. Seja direto e objetivo, mas amigável
8. Quando perguntarem sobre evolução/crescimento, use os dados de metas históricas vs atuais
9. Ao analisar performance, considere tanto os números absolutos quanto as porcentagens
10. Considere o contexto de todos os serviços contratados pela empresa ao dar recomendações
11. Use informações de NPS para avaliar satisfação do cliente
12. Considere o histórico de ações para entender o engajamento da equipe
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
