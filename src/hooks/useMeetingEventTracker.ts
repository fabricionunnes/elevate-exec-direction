import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks meeting events (scheduled/realized) for CRM analytics.
 * These are historical records that persist even if the lead moves to other stages.
 */

interface MeetingEventParams {
  leadId: string;
  pipelineId: string;
  stageId: string;
  triggeredByStaffId: string;
}

// Stage name patterns for detection
const SCHEDULED_PATTERNS = [/agendad[ao]/i, /reagendamento/i, /reunião\s*agendada/i, /meeting\s*scheduled/i];
const REALIZED_PATTERNS = [/realizad[ao]/i, /reunião\s*realizad/i, /meeting\s*held/i, /meeting\s*completed/i];

export const isScheduledStage = (stageName: string): boolean => {
  return SCHEDULED_PATTERNS.some(pattern => pattern.test(stageName));
};

export const isRealizedStage = (stageName: string): boolean => {
  return REALIZED_PATTERNS.some(pattern => pattern.test(stageName));
};

/**
 * Check if an event already exists for this lead/type combination
 */
const eventExists = async (leadId: string, eventType: 'scheduled' | 'realized'): Promise<boolean> => {
  const { data, error } = await supabase
    .from("crm_meeting_events")
    .select("id")
    .eq("lead_id", leadId)
    .eq("event_type", eventType)
    .limit(1);
  
  if (error) {
    console.error("Error checking meeting event:", error);
    return false;
  }
  
  return (data && data.length > 0);
};

/**
 * Get the scheduler staff ID from a lead
 */
const getSchedulerFromLead = async (leadId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from("crm_leads")
    .select("scheduled_by_staff_id")
    .eq("id", leadId)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data.scheduled_by_staff_id;
};

/**
 * Track when a lead enters a "scheduled" stage
 * - Records who scheduled the meeting
 * - Creates a "scheduled" event for that staff member
 */
export const trackScheduledEvent = async (params: MeetingEventParams): Promise<boolean> => {
  const { leadId, pipelineId, stageId, triggeredByStaffId } = params;
  
  try {
    // Check if already tracked
    const exists = await eventExists(leadId, 'scheduled');
    if (exists) {
      console.log("Scheduled event already exists for lead:", leadId);
      return true;
    }
    
    // Update lead with who scheduled and when
    await supabase
      .from("crm_leads")
      .update({
        scheduled_by_staff_id: triggeredByStaffId,
        scheduled_at: new Date().toISOString()
      })
      .eq("id", leadId);
    
    // Create the scheduled event
    const { error } = await supabase
      .from("crm_meeting_events")
      .insert({
        lead_id: leadId,
        pipeline_id: pipelineId,
        event_type: 'scheduled',
        credited_staff_id: triggeredByStaffId,
        triggered_by_staff_id: triggeredByStaffId,
        stage_id: stageId,
        event_date: new Date().toISOString()
      });
    
    if (error) {
      console.error("Error tracking scheduled event:", error);
      return false;
    }
    
    console.log("Scheduled event tracked for lead:", leadId, "by staff:", triggeredByStaffId);
    return true;
  } catch (error) {
    console.error("Error in trackScheduledEvent:", error);
    return false;
  }
};

/**
 * Track when a lead enters a "realized" stage
 * - Credits BOTH the original scheduler AND the person who moved the card
 * - If they are the same person, only one event is created
 */
export const trackRealizedEvent = async (params: MeetingEventParams): Promise<boolean> => {
  const { leadId, pipelineId, stageId, triggeredByStaffId } = params;
  
  try {
    // Check if already tracked
    const exists = await eventExists(leadId, 'realized');
    if (exists) {
      console.log("Realized event already exists for lead:", leadId);
      return true;
    }
    
    // Get the original scheduler
    const schedulerStaffId = await getSchedulerFromLead(leadId);
    
    const eventsToInsert: Array<{
      lead_id: string;
      pipeline_id: string;
      event_type: 'realized';
      credited_staff_id: string;
      triggered_by_staff_id: string;
      stage_id: string;
      event_date: string;
    }> = [];
    
    const eventDate = new Date().toISOString();
    
    // Credit the person who moved the card to "realized"
    eventsToInsert.push({
      lead_id: leadId,
      pipeline_id: pipelineId,
      event_type: 'realized',
      credited_staff_id: triggeredByStaffId,
      triggered_by_staff_id: triggeredByStaffId,
      stage_id: stageId,
      event_date: eventDate
    });
    
    // Also credit the original scheduler if different from who moved it
    if (schedulerStaffId && schedulerStaffId !== triggeredByStaffId) {
      eventsToInsert.push({
        lead_id: leadId,
        pipeline_id: pipelineId,
        event_type: 'realized',
        credited_staff_id: schedulerStaffId,
        triggered_by_staff_id: triggeredByStaffId,
        stage_id: stageId,
        event_date: eventDate
      });
    }
    
    const { error } = await supabase
      .from("crm_meeting_events")
      .insert(eventsToInsert);
    
    if (error) {
      console.error("Error tracking realized event:", error);
      return false;
    }
    
    console.log("Realized events tracked for lead:", leadId, "credited to:", eventsToInsert.map(e => e.credited_staff_id));
    return true;
  } catch (error) {
    console.error("Error in trackRealizedEvent:", error);
    return false;
  }
};

/**
 * Main function to handle stage change and track meeting events
 */
export const trackMeetingEventOnStageChange = async (
  leadId: string,
  pipelineId: string,
  newStageId: string,
  newStageName: string,
  triggeredByStaffId: string
): Promise<void> => {
  // Check if entering a "scheduled" stage
  if (isScheduledStage(newStageName)) {
    await trackScheduledEvent({
      leadId,
      pipelineId,
      stageId: newStageId,
      triggeredByStaffId
    });
  }
  
  // Check if entering a "realized" stage
  if (isRealizedStage(newStageName)) {
    await trackRealizedEvent({
      leadId,
      pipelineId,
      stageId: newStageId,
      triggeredByStaffId
    });
  }
};
