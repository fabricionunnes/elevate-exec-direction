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
    const { data: config } = await supabase
      .from("hr_whatsapp_config")
      .select("*, whatsapp_instances(*)")
      .eq("project_id", projectId)
      .maybeSingle();

    if (!config || !config.notify_on_stage_change || !config.instance_id) {
      return;
    }

    const instance = config.whatsapp_instances as any;
    if (!instance?.instance_name) {
      console.warn("HR WhatsApp instance not fully configured");
      return;
    }

    const template =
      config.message_template ||
      'O candidato {candidate_name} avançou para a etapa "{stage_name}" na vaga "{job_title}".';

    const message = template
      .replace(/{candidate_name}/g, candidateName)
      .replace(/{stage_name}/g, stageName)
      .replace(/{job_title}/g, jobTitle);

    const groupRecipient = config.notify_group_jid?.trim() || null;
    const phoneRecipient = config.notify_phone?.replace(/\D/g, "") || null;
    const recipient = groupRecipient || phoneRecipient;

    if (!recipient) {
      console.warn("No recipient configured for HR WhatsApp notifications");
      return;
    }

    const { data, error } = await supabase.functions.invoke("evolution-api", {
      body: {
        action: "sendText",
        instanceId: config.instance_id,
        phone: recipient,
        message,
      },
    });

    if (error) {
      console.error("Error sending HR WhatsApp notification via edge function:", error);
      return;
    }

    if (data?.error) {
      console.error("Evolution API returned an error for HR notification:", data);
      return;
    }

    console.log("HR WhatsApp notification sent successfully:", {
      recipient,
      usedGroup: Boolean(groupRecipient),
      data,
    });
  } catch (error) {
    console.error("Error sending HR WhatsApp notification:", error);
  }
}
