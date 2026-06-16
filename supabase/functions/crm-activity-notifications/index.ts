import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Remove sufixo /manager e barras finais da base URL
function normalizeBaseUrl(input: string | null | undefined): string {
  return (input || "").replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
}

// Detecta Stevo Manager V2 (*.stevo.chat) — usa endpoint /send/text
function isManagerV2Url(input?: string | null): boolean {
  try {
    return new URL(input || "").hostname.endsWith(".stevo.chat");
  } catch {
    return false;
  }
}

// Headers que funcionam nos diferentes installs Evolution/STEVO
function buildEvolutionHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    "x-api-key": apiKey,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Find pending activities that are due and not yet notified
    const { data: dueActivities, error: fetchError } = await supabase
      .from("crm_activities")
      .select(`
        id, title, type, scheduled_at, lead_id, responsible_staff_id,
        lead:crm_leads!crm_activities_lead_id_fkey(name)
      `)
      .eq("status", "pending")
      .is("notified_at", null)
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", now);

    if (fetchError) throw fetchError;

    if (!dueActivities || dueActivities.length === 0) {
      return new Response(JSON.stringify({ message: "No due activities", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the configured WhatsApp notification instance
    const { data: setting } = await supabase
      .from("crm_settings")
      .select("setting_value")
      .eq("setting_key", "lead_notification_instance_name")
      .maybeSingle();

    const instanceName = (setting?.setting_value as string) || null;

    let whatsappInstance: { id: string; instance_name: string; api_url: string; api_key: string } | null = null;

    if (instanceName) {
      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, status, api_url, api_key")
        .eq("instance_name", instanceName)
        .maybeSingle();

      if (inst) {
        whatsappInstance = inst;
      }
    }

    const typeLabel: Record<string, string> = {
      call: "Ligação",
      whatsapp: "WhatsApp",
      email: "E-mail",
      meeting: "Reunião",
      followup: "Follow-up",
      proposal: "Proposta",
      note: "Nota",
      other: "Atividade",
    };

    let notifiedCount = 0;

    for (const activity of dueActivities) {
      if (!activity.responsible_staff_id) continue;

      // Não notificar usuários inativos
      const { data: respStaff } = await supabase
        .from("onboarding_staff")
        .select("phone, name, is_active")
        .eq("id", activity.responsible_staff_id)
        .maybeSingle();
      if (!respStaff || respStaff.is_active === false) continue;

      const leadName = (activity.lead as any)?.name || "Lead";
      const label = typeLabel[activity.type] || "Atividade";
      let shouldMarkAsNotified = false;

      // 1) Create internal notification
      const { error: notifError } = await supabase
        .from("onboarding_notifications")
        .insert({
          staff_id: activity.responsible_staff_id,
          type: "crm_activity_due",
          title: `📋 ${label} pendente: ${activity.title}`,
          message: `Atividade agendada para ${leadName} está no horário. Verifique e conclua.`,
          reference_id: activity.lead_id,
          reference_type: "crm_lead",
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
        continue;
      }

      shouldMarkAsNotified = true;

      // 2) Send WhatsApp notification to responsible staff
      if (whatsappInstance) {
        try {
          let phone = respStaff.phone?.replace(/\D/g, "") || "";
          // Normalize: ensure Brazilian country code (55) is present
          if (phone && !phone.startsWith("55") && (phone.length === 10 || phone.length === 11)) {
            phone = "55" + phone;
          }

          if (phone) {
            let scheduledText = "";
            if (activity.scheduled_at) {
              const date = new Date(activity.scheduled_at);
              scheduledText = `\n*Agendado para:* ${date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}`;
            }

            const leadUrl = `https://unvholdings.com.br/#/crm/leads/${activity.lead_id}`;
            const message =
              `📋 *Atividade do CRM pendente!*\n\n` +
              `*Tipo:* ${label}\n` +
              `*Título:* ${activity.title}\n` +
              `*Lead:* ${leadName}` +
              scheduledText +
              `\n\n🔗 Acesse o lead: ${leadUrl}`;

            // Provider-aware: Stevo Manager V2 usa /send/text (sem instância no path);
            // Evolution padrão usa /message/sendText/{instanceName}
            const baseUrl = normalizeBaseUrl(whatsappInstance.api_url);
            const isV2 = isManagerV2Url(whatsappInstance.api_url);
            const sendUrl = isV2
              ? `${baseUrl}/send/text`
              : `${baseUrl}/message/sendText/${whatsappInstance.instance_name}`;

            const resp = await fetch(sendUrl, {
              method: "POST",
              headers: buildEvolutionHeaders(whatsappInstance.api_key),
              body: JSON.stringify({ number: phone, text: message }),
            });

            if (resp.ok) {
              await resp.text();
              console.log(`[crm-activity-notifications] WhatsApp sent to ${phone} (v2=${isV2}) for activity ${activity.id}`);
            } else {
              const errText = await resp.text();
              console.error(`[crm-activity-notifications] WhatsApp send failed (${resp.status}) url=${sendUrl}: ${errText}`);
              shouldMarkAsNotified = false;
            }
          } else {
            console.warn(`[crm-activity-notifications] Staff ${activity.responsible_staff_id} has no phone for activity ${activity.id}`);
            shouldMarkAsNotified = false;
          }
        } catch (whatsappError) {
          console.error("[crm-activity-notifications] WhatsApp error:", whatsappError);
          shouldMarkAsNotified = false;
        }
      } else {
        console.warn(`[crm-activity-notifications] No connected WhatsApp instance configured for activity ${activity.id}`);
        shouldMarkAsNotified = false;
      }

      // 3) Mark as notified
      if (shouldMarkAsNotified) {
        await supabase
          .from("crm_activities")
          .update({ notified_at: now })
          .eq("id", activity.id);

        notifiedCount++;
      }
    }

    return new Response(
      JSON.stringify({ message: "Notifications sent", count: notifiedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as any).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
