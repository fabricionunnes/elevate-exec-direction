import { supabase } from "@/integrations/supabase/client";
import { addBusinessDays, ensureBusinessDay } from "@/lib/businessDays";
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

    // Fetch lead info for notification
    const { data: leadData } = await supabase
      .from("crm_leads")
      .select("name")
      .eq("id", leadId)
      .single();

    // Fetch stage name for notification
    const { data: stageData } = await supabase
      .from("crm_stages")
      .select("name")
      .eq("id", stageId)
      .single();

    // Create activities for each action - using business days to avoid weekends/holidays
    const activities = actions.map((action: StageAction) => {
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
        responsible_staff_id: staffId || null,
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

    // Create notification for the responsible staff member
    if (staffId && leadData && stageData) {
      const activityCount = actions.length;
      const activityWord = activityCount === 1 ? "atividade foi criada" : "atividades foram criadas";
      
      const { error: notificationError } = await supabase
        .from("onboarding_notifications")
        .insert({
          staff_id: staffId,
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
