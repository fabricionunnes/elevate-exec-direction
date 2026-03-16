import { supabase } from "@/integrations/supabase/client";

interface NotifyParams {
  projectId: string;
  candidateName: string;
  stageName: string;
  jobTitle: string;
}

export async function notifyClientStageChange({
  projectId,
  candidateName,
  stageName,
  jobTitle,
}: NotifyParams) {
  try {
    // Fetch HR WhatsApp config with instance details
    const { data: config } = await supabase
      .from("hr_whatsapp_config")
      .select("*, whatsapp_instances(*)")
      .eq("project_id", projectId)
      .maybeSingle();

    if (!config || !config.notify_on_stage_change || !config.instance_id) {
      return; // Not configured or disabled
    }

    const instance = config.whatsapp_instances as any;
    if (!instance?.instance_name) {
      console.warn("HR WhatsApp instance not fully configured");
      return;
    }

    const template = config.message_template ||
      'O candidato {candidate_name} avançou para a etapa "{stage_name}" na vaga "{job_title}".';

    const message = template
      .replace(/{candidate_name}/g, candidateName)
      .replace(/{stage_name}/g, stageName)
      .replace(/{job_title}/g, jobTitle);

    const recipient = config.notify_group_jid || config.notify_phone;

    if (!recipient) {
      console.warn("No recipient configured for HR WhatsApp notifications");
      return;
    }

    // Use the evolution-api edge function instead of calling the API directly (avoids CORS)
    const { data, error } = await supabase.functions.invoke("evolution-api", {
      body: {
        action: "sendText",
        instanceId: config.instance_id,
        number: config.notify_group_jid ? undefined : recipient,
        jid: config.notify_group_jid || undefined,
        text: message,
      },
    });

    if (error) {
      console.error("Error sending HR WhatsApp notification via edge function:", error);
    } else {
      console.log("HR WhatsApp notification sent successfully:", data);
    }
  } catch (error) {
    console.error("Error sending HR WhatsApp notification:", error);
    // Don't throw - notification failure shouldn't block stage change
  }
}
