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
    // Fetch config via edge function to bypass RLS
    const { data: configData, error: configError } = await supabase.functions.invoke("hr-whatsapp-config", {
      body: { action: "get", projectId },
    });

    if (configError || configData?.error) {
      console.warn("Could not fetch HR WhatsApp config:", configError || configData?.error);
      return;
    }

    const config = configData?.config;
    if (!config || !config.notify_on_stage_change || !config.instance_id) {
      return;
    }

    // We need the instance_name, fetch it
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("instance_name")
      .eq("id", config.instance_id)
      .maybeSingle();

    if (!instance?.instance_name) {
      console.warn("HR WhatsApp instance not found for id:", config.instance_id);
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
      console.error("Error sending HR WhatsApp notification:", error);
      return;
    }

    if (data?.error) {
      console.error("Evolution API error for HR notification:", data);
      return;
    }

    console.log("HR WhatsApp notification sent successfully:", {
      recipient,
      usedGroup: Boolean(groupRecipient),
    });
  } catch (error) {
    console.error("Error sending HR WhatsApp notification:", error);
  }
}
