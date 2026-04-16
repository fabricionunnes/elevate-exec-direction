import { supabase } from "@/integrations/supabase/client";

interface NotifyActivityParams {
  staffId: string;
  leadName: string;
  activityTitle: string;
  activityType: string;
  scheduledAt?: string | null;
}

const typeLabels: Record<string, string> = {
  call: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  meeting: "Reunião",
  followup: "Follow-up",
  proposal: "Proposta",
  note: "Nota",
  other: "Atividade",
};

/**
 * Sends a WhatsApp notification to the responsible staff member
 * when a CRM activity is created, using the instance configured
 * in CRM Settings > Notificações.
 */
export async function notifyCrmActivityViaWhatsApp({
  staffId,
  leadName,
  activityTitle,
  activityType,
  scheduledAt,
}: NotifyActivityParams): Promise<void> {
  try {
    // 1) Get the configured notification instance name
    const { data: setting } = await supabase
      .from("crm_settings")
      .select("setting_value")
      .eq("setting_key", "lead_notification_instance_name")
      .maybeSingle();

    const instanceName = setting?.setting_value as string | null;
    if (!instanceName) return; // notifications not configured

    // 2) Resolve instance_name → instance row (id + status)
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, status")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (!instance || instance.status !== "connected") return;

    // 3) Get staff phone
    const { data: staff } = await supabase
      .from("onboarding_staff")
      .select("phone, name")
      .eq("id", staffId)
      .maybeSingle();

    let phone = staff?.phone?.replace(/\D/g, "") || "";
    if (phone && !phone.startsWith("55") && (phone.length === 10 || phone.length === 11)) {
      phone = "55" + phone;
    }
    if (!phone) return; // staff has no phone registered

    // 4) Build message
    const label = typeLabels[activityType] || "Atividade";
    let message = `📋 *Nova atividade no CRM*\n\n`;
    message += `*Tipo:* ${label}\n`;
    message += `*Título:* ${activityTitle}\n`;
    message += `*Lead:* ${leadName}\n`;

    if (scheduledAt) {
      const date = new Date(scheduledAt);
      const formatted = date.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      });
      message += `*Agendado para:* ${formatted}\n`;
    }

    message += `\nAcesse o CRM para mais detalhes.`;

    // 5) Send via evolution-api
    await supabase.functions.invoke("evolution-api", {
      body: {
        action: "sendText",
        instanceId: instance.id,
        phone,
        message,
      },
    });
  } catch (error) {
    // Best-effort — never block the main flow
    console.error("Error sending CRM activity WhatsApp notification:", error);
  }
}
