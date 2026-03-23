import { supabase } from "@/integrations/supabase/client";

/**
 * Triggers CSAT survey send after a meeting is finalized.
 * Creates a csat_survey if one doesn't exist, then invokes the survey-sender.
 */
export async function triggerCSATAfterFinalization(meetingId: string, projectId: string) {
  try {
    // Check if the meeting is marked as no-show — skip CSAT in that case
    const { data: meeting } = await supabase
      .from("onboarding_meeting_notes")
      .select("is_no_show")
      .eq("id", meetingId)
      .maybeSingle();

    if (meeting?.is_no_show) {
      console.log("Skipping CSAT: meeting marked as no-show");
      return;
    }

    // Check if a csat_survey already exists for this meeting
    const { data: existingSurvey } = await supabase
      .from("csat_surveys")
      .select("id")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    // Create csat_survey if it doesn't exist (in case trigger didn't fire)
    if (!existingSurvey) {
      await supabase
        .from("csat_surveys")
        .insert({ project_id: projectId, meeting_id: meetingId });
    }

    // Invoke survey-sender to process CSAT immediately
    const { error } = await supabase.functions.invoke("survey-sender", {
      body: { type: "csat" },
    });

    if (error) {
      console.error("Error invoking survey-sender for CSAT:", error);
    } else {
      console.log("CSAT survey-sender invoked successfully after meeting finalization");
    }
  } catch (err) {
    console.error("Error triggering CSAT after finalization:", err);
  }
}
