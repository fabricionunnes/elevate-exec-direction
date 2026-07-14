import { supabase } from "@/integrations/supabase/client";
import { addBusinessDays, ensureBusinessDay } from "@/lib/businessDays";
import { notifyCrmActivityViaWhatsApp } from "@/lib/crm/notifyActivityWhatsApp";
import type { Json } from "@/integrations/supabase/types";
interface StageAction {
  id: string;
  stage_id: string;
  activity_type: string;
  activity_title: string;
  activity_description: string | null;
  days_offset: number;
  is_required: boolean;
  sort_order: number;
  action_mode: string;
  whatsapp_template: string | null;
  meeting_staff_id: string | null;
  meeting_duration_minutes: number | null;
}

export async function createStageActivities(
  leadId: string, 
  stageId: string,
  staffId?: string
): Promise<void> {
  try {
    // Fetch stage actions for this stage
    const { data: actions, error: actionsError } = await supabase
      .from("crm_stage_actions")
      .select("*")
      .eq("stage_id", stageId)
      .order("sort_order");

    if (actionsError) {
      console.error("Error fetching stage actions:", actionsError);
      return;
    }

    if (!actions || actions.length === 0) {
      return; // No actions configured for this stage
    }

    // Fetch lead info (nome + donos) para notificação e definição de responsável
    const { data: leadData } = await supabase
      .from("crm_leads")
      .select("name, owner_staff_id, closer_staff_id, sdr_staff_id")
      .eq("id", leadId)
      .single();

    // Fetch stage name for notification
    const { data: stageData } = await supabase
      .from("crm_stages")
      .select("name")
      .eq("id", stageId)
      .single();

    // Responsável NUNCA pode ficar nulo: quem moveu > dono do lead > closer > sdr
    // > usuário logado. Antes ficava `staffId || null` e, como nenhum chamador
    // passava staffId, TODA tarefa de etapa nascia sem responsável.
    let responsibleId: string | null =
      staffId ||
      leadData?.owner_staff_id ||
      leadData?.closer_staff_id ||
      leadData?.sdr_staff_id ||
      null;
    if (!responsibleId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: me } = await supabase
          .from("onboarding_staff").select("id").eq("user_id", user.id).maybeSingle();
        responsibleId = me?.id || null;
      }
    }

    // Idempotência: não recriar ação que já existe pendente para o lead (mesmo
    // título). Sem isso, mover/re-renderizar o card criava dezenas de cópias.
    const actionTitles = actions.map((a: StageAction) => a.activity_title);
    const { data: existingRows } = await supabase
      .from("crm_activities")
      .select("title")
      .eq("lead_id", leadId)
      .eq("status", "pending")
      .in("title", actionTitles);
    const existingTitles = new Set((existingRows || []).map((r: { title: string }) => r.title));
    const pendingActions = actions.filter((a: StageAction) => !existingTitles.has(a.activity_title));
    if (pendingActions.length === 0) {
      return; // tudo que essa etapa criaria já existe pendente
    }

    // Create activities for each action - using business days to avoid weekends/holidays
    const activities = pendingActions.map((action: StageAction) => {
      let scheduledAt: string;
      if (action.days_offset && action.days_offset > 0) {
        scheduledAt = addBusinessDays(new Date(), action.days_offset).toISOString();
      } else {
        // Ensure today is also a business day
        scheduledAt = ensureBusinessDay(new Date()).toISOString();
      }

      // Build automation config based on action mode
      const isAutomation = action.action_mode !== 'task';
      let automationConfig: Json | null = null;

      if (isAutomation) {
        automationConfig = {
          mode: action.action_mode,
        };

        if (action.action_mode === 'whatsapp_send' && action.whatsapp_template) {
          automationConfig.whatsapp_template = action.whatsapp_template;
        }

        if (action.action_mode === 'schedule_meeting') {
          if (action.meeting_staff_id) {
            automationConfig.meeting_staff_id = action.meeting_staff_id;
          }
          if (action.meeting_duration_minutes) {
            automationConfig.meeting_duration_minutes = action.meeting_duration_minutes;
          }
        }
      }

      return {
        lead_id: leadId,
        type: action.activity_type,
        title: action.activity_title,
        description: action.activity_description,
        scheduled_at: scheduledAt,
        status: "pending",
        responsible_staff_id: responsibleId,
        created_by: staffId || responsibleId,
        is_automation: isAutomation,
        automation_config: automationConfig,
      };
    });

    const { error: insertError } = await supabase
      .from("crm_activities")
      .insert(activities);

    if (insertError) {
      console.error("Error creating stage activities:", insertError);
      return;
    }

    // Send WhatsApp notifications for each activity to the responsible staff
    if (responsibleId && leadData) {
      for (const activity of activities) {
        notifyCrmActivityViaWhatsApp({
          staffId: activity.responsible_staff_id || responsibleId,
          leadId,
          leadName: leadData.name || "Lead",
          activityTitle: activity.title,
          activityType: activity.type,
          scheduledAt: activity.scheduled_at,
        });
      }
    }

    // Create notification for the responsible staff member
    if (responsibleId && leadData && stageData) {
      const activityCount = pendingActions.length;
      const activityWord = activityCount === 1 ? "atividade foi criada" : "atividades foram criadas";

      const { error: notificationError } = await supabase
        .from("onboarding_notifications")
        .insert({
          staff_id: responsibleId,
          type: "crm_stage_activity",
          title: "Novas atividades do CRM",
          message: `${activityCount} ${activityWord} para o lead "${leadData.name}" na etapa "${stageData.name}".`,
          reference_id: leadId,
          reference_type: "crm_lead",
          is_read: false,
        });

      if (notificationError) {
        console.error("Error creating notification:", notificationError);
      }
    }
  } catch (error) {
    console.error("Error in createStageActivities:", error);
  }
}

export function useStageActions() {
  return {
    createStageActivities,
  };
}
