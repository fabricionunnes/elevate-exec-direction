import { supabase } from "@/integrations/supabase/client";
import { addDays } from "date-fns";

interface StageAction {
  id: string;
  stage_id: string;
  activity_type: string;
  activity_title: string;
  activity_description: string | null;
  days_offset: number;
  is_required: boolean;
  sort_order: number;
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

    // Create activities for each action
    const activities = actions.map((action: StageAction) => {
      const scheduledAt = action.days_offset 
        ? addDays(new Date(), action.days_offset).toISOString()
        : new Date().toISOString();

      return {
        lead_id: leadId,
        type: action.activity_type,
        title: action.activity_title,
        description: action.activity_description,
        scheduled_at: scheduledAt,
        status: "pending",
        responsible_staff_id: staffId || null,
      };
    });

    const { error: insertError } = await supabase
      .from("crm_activities")
      .insert(activities);

    if (insertError) {
      console.error("Error creating stage activities:", insertError);
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
