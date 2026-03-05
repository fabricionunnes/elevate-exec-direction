import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const body = await req.json();
    console.log("[clint-webhook] Received:", JSON.stringify(body).slice(0, 500));

    // Get config
    const { data: config } = await supabase
      .from("crm_clint_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.sync_enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: "sync disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (config.sync_direction === "crm_to_clint") {
      return new Response(JSON.stringify({ ok: true, skipped: "direction is crm_to_clint only" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate webhook secret if configured
    const webhookSecret = req.headers.get("x-webhook-secret") || req.headers.get("x-clint-secret");
    if (config.webhook_secret && webhookSecret !== config.webhook_secret) {
      console.warn("[clint-webhook] Invalid webhook secret");
      return new Response(JSON.stringify({ error: "Invalid secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine event type from Clint payload
    // Clint webhooks typically send: { event: "contact.created", data: {...} }
    const event = body.event || body.type || "";
    const data = body.data || body;

    // Check if this is a sync-back (anti-loop): if payload has our sync flag, skip
    if (data._crm_sync_origin === "crm_comercial") {
      console.log("[clint-webhook] Skipping sync-back loop");
      return new Response(JSON.stringify({ ok: true, skipped: "anti-loop" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = { ok: true };

    if (event.includes("contact") || data.phone || data.email || data.name) {
      result = await handleContactWebhook(supabase, config, data, event);
    } else if (event.includes("deal") || data.deal_id || data.funnel) {
      result = await handleDealWebhook(supabase, config, data, event);
    } else {
      // Try to handle as a generic contact payload
      if (data.name || data.phone) {
        result = await handleContactWebhook(supabase, config, data, event);
      } else {
        console.log("[clint-webhook] Unknown event type:", event);
        result = { ok: true, skipped: "unknown event" };
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[clint-webhook] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleContactWebhook(supabase: any, config: any, data: any, event: string) {
  const clintContactId = data.id || data.contact_id || data._id || "";
  const name = data.name || data.full_name || "";
  const phone = data.phone || data.cellphone || data.whatsapp || "";
  const email = data.email || "";
  const company = data.company || data.organization || "";
  const tags = data.tags || [];
  const origin = data.origin || data.source || "";

  if (!name && !phone && !email) {
    return { ok: true, skipped: "no identifiable data" };
  }

  // Check if we already synced this contact
  let existingSync = null;
  if (clintContactId) {
    const { data: sync } = await supabase
      .from("crm_clint_sync_log")
      .select("*, crm_lead_id")
      .eq("clint_contact_id", clintContactId)
      .eq("sync_status", "success")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingSync = sync;
  }

  // Also try to find by phone or email
  if (!existingSync && (phone || email)) {
    let leadQuery = supabase.from("crm_leads").select("id");
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      leadQuery = leadQuery.or(`phone.ilike.%${cleanPhone.slice(-9)}%`);
    }
    if (email) {
      leadQuery = leadQuery.or(`email.ilike.${email}`);
    }
    const { data: existingLead } = await leadQuery.limit(1).maybeSingle();
    if (existingLead) {
      existingSync = { crm_lead_id: existingLead.id };
    }
  }

  const isUpdate = event.includes("update") || !!existingSync;

  if (isUpdate && existingSync?.crm_lead_id) {
    // Update existing lead
    const updateData: any = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (email) updateData.email = email;
    if (company) updateData.company = company;

    const { error } = await supabase
      .from("crm_leads")
      .update(updateData)
      .eq("id", existingSync.crm_lead_id);

    if (error) {
      await logSync(supabase, existingSync.crm_lead_id, clintContactId, null, "clint_to_crm", "error", error.message, data);
      return { ok: false, error: error.message };
    }

    // Log history
    await supabase.from("crm_lead_history").insert({
      lead_id: existingSync.crm_lead_id,
      action: "clint_sync",
      field_changed: "contact_update",
      new_value: `Atualizado via Clint: ${name}`,
      notes: `Sincronizado da Clint (contato ${clintContactId})`,
    });

    await logSync(supabase, existingSync.crm_lead_id, clintContactId, null, "clint_to_crm", "success", null, data);
    return { ok: true, action: "updated", lead_id: existingSync.crm_lead_id };
  } else {
    // Create new lead
    const leadData: any = {
      name: name || "Sem nome (Clint)",
      phone: phone || null,
      email: email || null,
      company: company || null,
      origin: origin || "Clint",
      pipeline_id: config.default_pipeline_id || null,
      stage_id: config.default_stage_id || null,
    };

    const { data: newLead, error } = await supabase
      .from("crm_leads")
      .insert(leadData)
      .select("id")
      .single();

    if (error) {
      await logSync(supabase, null, clintContactId, null, "clint_to_crm", "error", error.message, data);
      return { ok: false, error: error.message };
    }

    // Log history
    await supabase.from("crm_lead_history").insert({
      lead_id: newLead.id,
      action: "clint_sync",
      field_changed: "lead_created",
      new_value: `Lead criado via Clint: ${name}`,
      notes: `Importado da Clint (contato ${clintContactId})`,
    });

    await logSync(supabase, newLead.id, clintContactId, null, "clint_to_crm", "success", null, data);
    return { ok: true, action: "created", lead_id: newLead.id };
  }
}

async function handleDealWebhook(supabase: any, config: any, data: any, event: string) {
  const clintDealId = data.deal_id || data.id || "";
  const clintContactId = data.contact_id || data.client_id || "";
  const value = data.value || data.amount || 0;
  const status = data.status || "";
  const funnelStep = data.funnel_step || data.stage || "";

  // Find linked lead
  let leadId = null;
  if (clintContactId) {
    const { data: sync } = await supabase
      .from("crm_clint_sync_log")
      .select("crm_lead_id")
      .eq("clint_contact_id", clintContactId)
      .eq("sync_status", "success")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    leadId = sync?.crm_lead_id;
  }

  if (!leadId) {
    // Try to find by deal_id in sync log
    const { data: sync } = await supabase
      .from("crm_clint_sync_log")
      .select("crm_lead_id")
      .eq("clint_deal_id", clintDealId)
      .eq("sync_status", "success")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    leadId = sync?.crm_lead_id;
  }

  if (!leadId) {
    await logSync(supabase, null, clintContactId, clintDealId, "clint_to_crm", "error", "Lead not found for deal", data);
    return { ok: false, error: "Lead not found for this deal" };
  }

  // Update lead with deal info
  const updateData: any = {};
  if (value) updateData.opportunity_value = value;

  // Map deal status to stage if pipeline_mapping exists
  if (config.pipeline_mapping && funnelStep) {
    const mapping = config.pipeline_mapping as Record<string, string>;
    const mappedStageId = mapping[funnelStep];
    if (mappedStageId) {
      updateData.stage_id = mappedStageId;
    }
  }

  // Handle loss status
  if (status === "lost" || status === "perdido") {
    // Find a "lost" final stage
    const { data: lostStage } = await supabase
      .from("crm_stages")
      .select("id")
      .eq("pipeline_id", config.default_pipeline_id)
      .eq("is_final", true)
      .eq("final_type", "lost")
      .limit(1)
      .maybeSingle();

    if (lostStage) {
      updateData.stage_id = lostStage.id;
      updateData.closed_at = new Date().toISOString();
    }
  }

  if (Object.keys(updateData).length > 0) {
    await supabase.from("crm_leads").update(updateData).eq("id", leadId);
  }

  await supabase.from("crm_lead_history").insert({
    lead_id: leadId,
    action: "clint_sync",
    field_changed: "deal_update",
    new_value: `Deal atualizado via Clint: ${status || funnelStep}`,
    notes: `Sincronizado da Clint (deal ${clintDealId})`,
  });

  await logSync(supabase, leadId, clintContactId, clintDealId, "clint_to_crm", "success", null, data);
  return { ok: true, action: "deal_updated", lead_id: leadId };
}

async function logSync(
  supabase: any,
  crmLeadId: string | null,
  clintContactId: string | null,
  clintDealId: string | null,
  direction: string,
  status: string,
  errorMessage: string | null,
  payload: any
) {
  await supabase.from("crm_clint_sync_log").insert({
    crm_lead_id: crmLeadId,
    clint_contact_id: clintContactId,
    clint_deal_id: clintDealId,
    sync_direction: direction,
    sync_status: status,
    error_message: errorMessage,
    payload,
  });
}
