import { supabase } from "@/integrations/supabase/client";

/**
 * Triggers a background sync of a CRM lead to Clint.
 * Non-blocking — fires and forgets, logging errors to console.
 */
export const syncLeadToClint = async (leadId: string, action: string = "update") => {
  try {
    const { error } = await supabase.functions.invoke("clint-sync", {
      body: { lead_id: leadId, action },
    });
    if (error) {
      console.warn("[Clint Sync] Error:", error.message);
    }
  } catch (err) {
    console.warn("[Clint Sync] Failed:", err);
  }
};
