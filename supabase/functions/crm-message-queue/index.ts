import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action || "process_queue";

    // === ACTION: enqueue - enqueue messages for a lead based on trigger ===
    if (action === "enqueue") {
      const { trigger_type, lead_id, lead_name, lead_phone, lead_email, company_name, pipeline_id, pipeline_name, stage_id, stage_name } = body;

      if (!trigger_type || !lead_id || !lead_phone) {
        return new Response(
          JSON.stringify({ error: "trigger_type, lead_id, and lead_phone are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find matching active rules
      let query = supabase
        .from("crm_notification_rules")
        .select("*, crm_notification_rule_messages(*)")
        .eq("trigger_type", trigger_type)
        .eq("is_active", true);

      const { data: rules, error: rulesError } = await query;
      if (rulesError) throw rulesError;

      if (!rules || rules.length === 0) {
        return new Response(
          JSON.stringify({ message: "No matching rules", enqueued: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Filter rules by pipeline/stage
      const matchingRules = rules.filter((rule: any) => {
        if (rule.pipeline_id && rule.pipeline_id !== pipeline_id) return false;
        if (rule.stage_id && rule.stage_id !== stage_id) return false;
        return true;
      });

      if (matchingRules.length === 0) {
        return new Response(
          JSON.stringify({ message: "No rules match pipeline/stage", enqueued: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Normalize phone
      let cleanPhone = lead_phone.replace(/\D/g, "");
      if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = "55" + cleanPhone;
      if (cleanPhone.length === 12 && cleanPhone.startsWith("55")) {
        cleanPhone = cleanPhone.slice(0, 4) + "9" + cleanPhone.slice(4);
      }

      const firstName = (lead_name || "").split(" ")[0] || "";

      let totalEnqueued = 0;
      const now = new Date();

      for (const rule of matchingRules) {
        const msgs = (rule.crm_notification_rule_messages || []).sort(
          (a: any, b: any) => a.sort_order - b.sort_order
        );

        for (const msg of msgs) {
          // Replace template variables
          let text = msg.message_template;
          text = text.replace(/\{lead_name\}/g, lead_name || "");
          text = text.replace(/\{primeiro_nome\}/g, firstName);
          text = text.replace(/\{lead_phone\}/g, lead_phone || "");
          text = text.replace(/\{lead_email\}/g, lead_email || "");
          text = text.replace(/\{company_name\}/g, company_name || "");
          text = text.replace(/\{pipeline_name\}/g, pipeline_name || "");
          text = text.replace(/\{stage_name\}/g, stage_name || "");

          const scheduledAt = new Date(now.getTime() + msg.delay_minutes * 60 * 1000);

          const { error: insertError } = await supabase
            .from("crm_notification_queue")
            .insert({
              rule_id: rule.id,
              message_id: msg.id,
              lead_id,
              phone: cleanPhone,
              message_text: text,
              whatsapp_instance_id: rule.whatsapp_instance_id,
              scheduled_at: scheduledAt.toISOString(),
              status: "pending",
            });

          if (insertError) {
            console.error("[crm-message-queue] Insert error:", insertError);
          } else {
            totalEnqueued++;
          }
        }
      }

      console.log(`[crm-message-queue] Enqueued ${totalEnqueued} messages for lead ${lead_id}`);

      return new Response(
        JSON.stringify({ message: "OK", enqueued: totalEnqueued }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ACTION: process_queue - send pending messages that are due ===
    const now = new Date().toISOString();

    const { data: pendingMessages, error: fetchError } = await supabase
      .from("crm_notification_queue")
      .select("*, whatsapp_instances:whatsapp_instance_id(instance_name, api_url, api_key)")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("scheduled_at")
      .limit(50);

    if (fetchError) throw fetchError;

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending messages", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[crm-message-queue] Processing ${pendingMessages.length} pending messages`);

    let sentCount = 0;
    let failedCount = 0;

    for (const msg of pendingMessages) {
      const instance = msg.whatsapp_instances;

      if (!instance?.api_url || !instance?.api_key || !instance?.instance_name) {
        await supabase
          .from("crm_notification_queue")
          .update({ status: "failed", error_message: "Instância não encontrada ou desconectada", sent_at: now })
          .eq("id", msg.id);
        failedCount++;
        continue;
      }

      try {
        const sendUrl = `${instance.api_url}/message/sendText/${instance.instance_name}`;
        const resp = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.api_key,
          },
          body: JSON.stringify({ number: msg.phone, text: msg.message_text }),
        });

        if (!resp.ok && resp.status !== 504) {
          const errText = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${errText}`);
        }

        // Consume body
        if (resp.ok) await resp.text();

        await supabase
          .from("crm_notification_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", msg.id);

        sentCount++;
        console.log(`[crm-message-queue] Sent to ${msg.phone}`);
      } catch (sendError: any) {
        console.error(`[crm-message-queue] Send error for ${msg.phone}:`, sendError.message);
        await supabase
          .from("crm_notification_queue")
          .update({ status: "failed", error_message: sendError.message, sent_at: new Date().toISOString() })
          .eq("id", msg.id);
        failedCount++;
      }
    }

    return new Response(
      JSON.stringify({ message: "OK", sent: sentCount, failed: failedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[crm-message-queue] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
