import { supabase } from "@/integrations/supabase/client";

export interface LegacyActivity {
  id: string;
  action_type: string;
  action_description: string;
  created_at: string;
  user_id?: string;
  project_id?: string;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  is_legacy: boolean;
  source_table: string;
}

interface FetchLegacyActivitiesOptions {
  projectId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Busca atividades legadas de múltiplas tabelas que existiam antes do sistema de tracking
 * Retorna em formato padronizado para ser mesclado com client_activity_logs
 */
export async function fetchLegacyActivities(
  options: FetchLegacyActivitiesOptions
): Promise<LegacyActivity[]> {
  const { projectId, userId, startDate, endDate, limit = 500 } = options;
  const activities: LegacyActivity[] = [];

  try {
    // 1. Buscar vagas criadas (job_openings)
    if (projectId) {
      let jobQuery = supabase
        .from("job_openings")
        .select("id, title, project_id, created_at, created_by")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (startDate) jobQuery = jobQuery.gte("created_at", startDate);
      if (endDate) jobQuery = jobQuery.lte("created_at", endDate);

      const { data: jobOpenings } = await jobQuery;
      
      if (jobOpenings) {
        activities.push(
          ...jobOpenings.map((job) => ({
            id: `legacy_job_${job.id}`,
            action_type: "job_opening_created",
            action_description: `Criou vaga: ${job.title}`,
            created_at: job.created_at,
            user_id: job.created_by || undefined,
            project_id: job.project_id,
            entity_type: "job_opening",
            entity_id: job.id,
            entity_name: job.title,
            is_legacy: true,
            source_table: "job_openings",
          }))
        );
      }
    }

    // 2. Buscar candidatos adicionados
    if (projectId) {
      let candidatesQuery = supabase
        .from("candidates")
        .select("id, full_name, project_id, created_at, created_by_user_id, job_opening_id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (startDate) candidatesQuery = candidatesQuery.gte("created_at", startDate);
      if (endDate) candidatesQuery = candidatesQuery.lte("created_at", endDate);

      const { data: candidates } = await candidatesQuery;
      
      if (candidates) {
        activities.push(
          ...candidates
            .filter((c) => c.created_by_user_id) // Só incluir se foi criado por um usuário (cliente)
            .map((candidate) => ({
              id: `legacy_candidate_${candidate.id}`,
              action_type: "candidate_added",
              action_description: `Adicionou candidato: ${candidate.full_name}`,
              created_at: candidate.created_at,
              user_id: candidate.created_by_user_id || undefined,
              project_id: candidate.project_id,
              entity_type: "candidate",
              entity_id: candidate.id,
              entity_name: candidate.full_name,
              is_legacy: true,
              source_table: "candidates",
            }))
        );
      }
    }

    // 3. Buscar tarefas completadas (onboarding_tasks)
    if (projectId) {
      let tasksQuery = supabase
        .from("onboarding_tasks")
        .select("id, title, project_id, completed_at, status")
        .eq("project_id", projectId)
        .eq("status", "completed")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(limit);

      if (startDate) tasksQuery = tasksQuery.gte("completed_at", startDate);
      if (endDate) tasksQuery = tasksQuery.lte("completed_at", endDate);

      const { data: tasks } = await tasksQuery;
      
      if (tasks) {
        activities.push(
          ...tasks.map((task) => ({
            id: `legacy_task_${task.id}`,
            action_type: "task_completed",
            action_description: `Completou tarefa: ${task.title}`,
            created_at: task.completed_at!,
            project_id: task.project_id,
            entity_type: "task",
            entity_id: task.id,
            entity_name: task.title,
            is_legacy: true,
            source_table: "onboarding_tasks",
          }))
        );
      }
    }

    // 4. Buscar respostas de NPS
    if (projectId) {
      let npsQuery = supabase
        .from("onboarding_nps_responses")
        .select("id, score, respondent_name, project_id, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (startDate) npsQuery = npsQuery.gte("created_at", startDate);
      if (endDate) npsQuery = npsQuery.lte("created_at", endDate);

      const { data: npsResponses } = await npsQuery;
      
      if (npsResponses) {
        activities.push(
          ...npsResponses.map((nps) => ({
            id: `legacy_nps_${nps.id}`,
            action_type: "nps_submitted",
            action_description: `Respondeu NPS: nota ${nps.score}`,
            created_at: nps.created_at,
            project_id: nps.project_id,
            entity_type: "nps",
            entity_id: nps.id,
            entity_name: `NPS ${nps.score}`,
            is_legacy: true,
            source_table: "onboarding_nps_responses",
          }))
        );
      }
    }

    // 5. Buscar tickets/chamados criados pelo cliente
    if (projectId) {
      let ticketsQuery = supabase
        .from("onboarding_tickets")
        .select("id, subject, project_id, created_at, created_by")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (startDate) ticketsQuery = ticketsQuery.gte("created_at", startDate);
      if (endDate) ticketsQuery = ticketsQuery.lte("created_at", endDate);

      const { data: tickets } = await ticketsQuery;
      
      if (tickets) {
        activities.push(
          ...tickets.map((ticket) => ({
            id: `legacy_ticket_${ticket.id}`,
            action_type: "ticket_created",
            action_description: `Criou chamado: ${ticket.subject}`,
            created_at: ticket.created_at,
            user_id: ticket.created_by || undefined,
            project_id: ticket.project_id,
            entity_type: "ticket",
            entity_id: ticket.id,
            entity_name: ticket.subject,
            is_legacy: true,
            source_table: "onboarding_tickets",
          }))
        );
      }
    }

    // Ordenar por data decrescente e aplicar limite
    activities.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return activities.slice(0, limit);
  } catch (error) {
    console.error("Error fetching legacy activities:", error);
    return [];
  }
}

/**
 * Conta o total de atividades legadas para um projeto
 */
export async function countLegacyActivities(projectId: string): Promise<number> {
  let total = 0;

  try {
    // Contar vagas
    const { count: jobCount } = await supabase
      .from("job_openings")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    total += jobCount || 0;

    // Contar candidatos (só os criados por usuários)
    const { count: candidateCount } = await supabase
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .not("created_by_user_id", "is", null);
    total += candidateCount || 0;

    // Contar tarefas completadas
    const { count: taskCount } = await supabase
      .from("onboarding_tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "completed")
      .not("completed_at", "is", null);
    total += taskCount || 0;

    // Contar NPS
    const { count: npsCount } = await supabase
      .from("onboarding_nps_responses")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    total += npsCount || 0;

    // Contar tickets
    const { count: ticketCount } = await supabase
      .from("onboarding_tickets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    total += ticketCount || 0;

    return total;
  } catch (error) {
    console.error("Error counting legacy activities:", error);
    return 0;
  }
}
