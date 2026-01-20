import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ActivityTrackingOptions {
  userId: string;
  projectId: string;
  accessLogId?: string | null;
}

type ActionType = 
  | 'page_view'
  | 'task_completed'
  | 'task_created'
  | 'task_updated'
  | 'meeting_scheduled'
  | 'meeting_completed'
  | 'ticket_created'
  | 'ticket_replied'
  | 'file_uploaded'
  | 'file_downloaded'
  | 'note_added'
  | 'form_submitted'
  | 'nps_submitted'
  | 'support_session_started'
  | 'board_session_created'
  | 'financial_entry_created'
  | 'job_opening_created'
  | 'candidate_added'
  | 'profile_updated'
  | 'button_clicked'
  | 'tab_changed'
  | 'export_generated';

interface TrackActivityParams {
  actionType: ActionType;
  actionDescription: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  metadata?: Record<string, any>;
  pagePath?: string;
}

/**
 * Hook para rastrear atividades do cliente no sistema
 * Registra todas as ações importantes feitas pelo usuário
 */
export const useClientActivityTracking = (options: ActivityTrackingOptions | null) => {
  const lastActivityRef = useRef<string | null>(null);

  const trackActivity = useCallback(async (params: TrackActivityParams) => {
    if (!options?.userId || !options?.projectId) return;

    // Avoid duplicate consecutive logs
    const activityKey = `${params.actionType}-${params.entityId || ''}-${params.pagePath || ''}`;
    if (lastActivityRef.current === activityKey) return;
    lastActivityRef.current = activityKey;

    // Reset after 2 seconds to allow same action later
    setTimeout(() => {
      if (lastActivityRef.current === activityKey) {
        lastActivityRef.current = null;
      }
    }, 2000);

    try {
      await supabase
        .from("client_activity_logs" as any)
        .insert({
          access_log_id: options.accessLogId || null,
          user_id: options.userId,
          project_id: options.projectId,
          action_type: params.actionType,
          action_description: params.actionDescription,
          entity_type: params.entityType || null,
          entity_id: params.entityId || null,
          entity_name: params.entityName || null,
          metadata: params.metadata || {},
          page_path: params.pagePath || window.location.pathname + window.location.hash,
        });
    } catch (error) {
      console.warn("Error tracking activity:", error);
    }
  }, [options?.userId, options?.projectId, options?.accessLogId]);

  // Helper functions for common actions
  const trackPageView = useCallback((pageName: string, pagePath?: string) => {
    trackActivity({
      actionType: 'page_view',
      actionDescription: `Visualizou a página: ${pageName}`,
      entityType: 'page',
      entityName: pageName,
      pagePath,
    });
  }, [trackActivity]);

  const trackTaskCompleted = useCallback((taskId: string, taskTitle: string) => {
    trackActivity({
      actionType: 'task_completed',
      actionDescription: `Concluiu a tarefa: ${taskTitle}`,
      entityType: 'task',
      entityId: taskId,
      entityName: taskTitle,
    });
  }, [trackActivity]);

  const trackTaskCreated = useCallback((taskId: string, taskTitle: string) => {
    trackActivity({
      actionType: 'task_created',
      actionDescription: `Criou a tarefa: ${taskTitle}`,
      entityType: 'task',
      entityId: taskId,
      entityName: taskTitle,
    });
  }, [trackActivity]);

  const trackMeetingScheduled = useCallback((meetingId: string, meetingTitle: string) => {
    trackActivity({
      actionType: 'meeting_scheduled',
      actionDescription: `Agendou a reunião: ${meetingTitle}`,
      entityType: 'meeting',
      entityId: meetingId,
      entityName: meetingTitle,
    });
  }, [trackActivity]);

  const trackTicketCreated = useCallback((ticketId: string, ticketSubject: string) => {
    trackActivity({
      actionType: 'ticket_created',
      actionDescription: `Abriu o chamado: ${ticketSubject}`,
      entityType: 'ticket',
      entityId: ticketId,
      entityName: ticketSubject,
    });
  }, [trackActivity]);

  const trackFileUploaded = useCallback((fileName: string) => {
    trackActivity({
      actionType: 'file_uploaded',
      actionDescription: `Enviou o arquivo: ${fileName}`,
      entityType: 'file',
      entityName: fileName,
    });
  }, [trackActivity]);

  const trackFormSubmitted = useCallback((formName: string, formId?: string) => {
    trackActivity({
      actionType: 'form_submitted',
      actionDescription: `Preencheu o formulário: ${formName}`,
      entityType: 'form',
      entityId: formId,
      entityName: formName,
    });
  }, [trackActivity]);

  const trackNpsSubmitted = useCallback((score: number) => {
    trackActivity({
      actionType: 'nps_submitted',
      actionDescription: `Respondeu NPS com nota: ${score}`,
      entityType: 'nps',
      metadata: { score },
    });
  }, [trackActivity]);

  const trackTabChanged = useCallback((tabName: string) => {
    trackActivity({
      actionType: 'tab_changed',
      actionDescription: `Navegou para a aba: ${tabName}`,
      entityType: 'tab',
      entityName: tabName,
    });
  }, [trackActivity]);

  const trackButtonClicked = useCallback((buttonName: string, context?: string) => {
    trackActivity({
      actionType: 'button_clicked',
      actionDescription: `Clicou em: ${buttonName}${context ? ` (${context})` : ''}`,
      entityType: 'button',
      entityName: buttonName,
      metadata: context ? { context } : undefined,
    });
  }, [trackActivity]);

  const trackJobOpeningCreated = useCallback((jobId: string, jobTitle: string) => {
    trackActivity({
      actionType: 'job_opening_created',
      actionDescription: `Criou a vaga: ${jobTitle}`,
      entityType: 'job_opening',
      entityId: jobId,
      entityName: jobTitle,
    });
  }, [trackActivity]);

  const trackCandidateAdded = useCallback((candidateId: string, candidateName: string, jobTitle?: string) => {
    trackActivity({
      actionType: 'candidate_added',
      actionDescription: `Adicionou candidato: ${candidateName}${jobTitle ? ` para a vaga ${jobTitle}` : ''}`,
      entityType: 'candidate',
      entityId: candidateId,
      entityName: candidateName,
      metadata: jobTitle ? { job_title: jobTitle } : undefined,
    });
  }, [trackActivity]);

  return {
    trackActivity,
    trackPageView,
    trackTaskCompleted,
    trackTaskCreated,
    trackMeetingScheduled,
    trackTicketCreated,
    trackFileUploaded,
    trackFormSubmitted,
    trackNpsSubmitted,
    trackTabChanged,
    trackButtonClicked,
    trackJobOpeningCreated,
    trackCandidateAdded,
  };
};
