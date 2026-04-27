// Edge function: notify when public Contract Data form is submitted
// Notifies: lead owner + all active masters + all active head_comercial
// Channels: in-system (onboarding_notifications) + WhatsApp via configured default instance

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  leadId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId } = (await req.json()) as Payload;
    if (!leadId) {
      return new Response(JSON.stringify({ error: "leadId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1) Fetch lead
    const { data: lead, error: leadErr } = await supabase
      .from("crm_leads")
      .select("id, name, company, owner_staff_id")
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found", details: leadErr?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2) Build recipient list: owner + masters + head_comercial
    const recipientIds = new Set<string>();
    if (lead.owner_staff_id) recipientIds.add(lead.owner_staff_id);

    const { data: leaders } = await supabase
      .from("onboarding_staff")
      .select("id")
      .eq("is_active", true)
      .in("role", ["master", "head_comercial"]);

    (leaders || []).forEach((s: { id: string }) => recipientIds.add(s.id));

    if (recipientIds.size === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No recipients" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ids = Array.from(recipientIds);

    // 3) Fetch staff details (name + phone)
    const { data: staffList } = await supabase
      .from("onboarding_staff")
      .select("id, name, phone")
      .in("id", ids);

    const leadLabel = lead.company
      ? `${lead.name} (${lead.company})`
      : lead.name;

    const title = "📄 Dados Contratuais Preenchidos";
    const message = `O lead ${leadLabel} preencheu o formulário de dados contratuais.`;

    // 4) Insert in-system notifications
    const notificationRows = ids.map((staffId) => ({
      staff_id: staffId,
      type: "contract",
      title,
      message,
      reference_id: lead.id,
      reference_type: "crm_lead",
      is_read: false,
    }));

    const { error: notifErr } = await supabase
      .from("onboarding_notifications")
      .insert(notificationRows);

    if (notifErr) {
      console.error("Error inserting notifications:", notifErr);
    }

    // 5) WhatsApp — fetch configured default instance
    const { data: setting } = await supabase
      .from("crm_settings")
      .select("setting_value")
      .eq("setting_key", "lead_notification_instance_name")
      .maybeSingle();

    const instanceName = setting?.setting_value as string | null;
    let whatsappResults: any[] = [];

    if (instanceName) {
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("id, status")
        .eq("instance_name", instanceName)
        .maybeSingle();

      if (instance && instance.status === "connected") {
        const leadUrl = `https://unvholdings.com.br/#/crm/leads/${lead.id}`;
        const waMessage =
          `📄 *Dados Contratuais Preenchidos*\n\n` +
          `*Lead:* ${leadLabel}\n\n` +
          `O lead acabou de preencher o formulário de dados contratuais.\n\n` +
          `🔗 Acesse o lead: ${leadUrl}`;

        for (const staff of staffList || []) {
          let phone = (staff.phone || "").replace(/\D/g, "");
          if (!phone) continue;
          if (
            !phone.startsWith("55") &&
            (phone.length === 10 || phone.length === 11)
          ) {
            phone = "55" + phone;
          }

          try {
            const { data: sendResult, error: sendErr } =
              await supabase.functions.invoke("evolution-api", {
                body: {
                  action: "sendText",
                  instanceId: instance.id,
                  phone,
                  message: waMessage,
                },
              });
            whatsappResults.push({
              staffId: staff.id,
              ok: !sendErr && !sendResult?.error,
              error: sendErr?.message || sendResult?.error,
            });
          } catch (err) {
            whatsappResults.push({
              staffId: staff.id,
              ok: false,
              error: (err as Error).message,
            });
          }
        }
      } else {
        console.warn("WhatsApp instance not connected:", instanceName);
      }
    } else {
      console.warn("No default notification instance configured");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        notifiedStaff: ids.length,
        whatsapp: whatsappResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("notify-contract-form-submitted error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
