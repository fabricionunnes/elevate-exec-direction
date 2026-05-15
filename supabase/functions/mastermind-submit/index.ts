// mastermind-submit: Salva aplicação Mastermind + cria lead no CRM + notifica Fabrício via WhatsApp
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://elevate-exec-direction.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // === Backfill mode: migrate existing mastermind_applications to CRM ===
    if (body.action === "backfill") {
      return await handleBackfill(supabase);
    }

    // === Normal submission ===
    const {
      full_name, email, phone, company, role, role_other,
      monthly_revenue, company_age, employees_count, salespeople_count,
      main_challenge, upcoming_decision, energy_drain, feels_alone,
      willing_to_share_numbers, reaction_to_confrontation, contribution_to_group, validation_or_confrontation,
      available_for_meetings, understands_mansion_costs, agrees_confidentiality,
      aware_of_investment, why_right_moment, success_definition,
      is_decision_maker, understands_not_operational, understands_may_be_refused, commits_confidentiality,
    } = body;

    if (!full_name || !email || !phone) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: full_name, email, phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Save to mastermind_applications
    const { data: app, error: appError } = await supabase
      .from("mastermind_applications")
      .insert({
        full_name, email, phone, company: company || null, role, role_other: role_other || null,
        monthly_revenue, company_age,
        employees_count: Number(employees_count) || 0,
        salespeople_count: Number(salespeople_count) || 0,
        main_challenge, upcoming_decision, energy_drain, feels_alone,
        willing_to_share_numbers: Boolean(willing_to_share_numbers),
        reaction_to_confrontation, contribution_to_group, validation_or_confrontation,
        available_for_meetings: Boolean(available_for_meetings),
        understands_mansion_costs: Boolean(understands_mansion_costs),
        agrees_confidentiality: Boolean(agrees_confidentiality),
        aware_of_investment: Boolean(aware_of_investment),
        why_right_moment, success_definition,
        is_decision_maker: Boolean(is_decision_maker),
        understands_not_operational: Boolean(understands_not_operational),
        understands_may_be_refused: Boolean(understands_may_be_refused),
        commits_confidentiality: Boolean(commits_confidentiality),
      })
      .select("id")
      .single();

    if (appError) {
      console.error("[mastermind-submit] Application insert error:", appError);
      return new Response(JSON.stringify({ error: "Erro ao salvar aplicação", details: appError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Create CRM lead + send WhatsApp (best-effort, don't fail submission)
    try {
      const leadId = await createCrmLead(supabase, {
        full_name, email, phone, company: company || null, role: role_other || role,
        monthly_revenue, employees_count: Number(employees_count) || 0,
        salespeople_count: Number(salespeople_count) || 0, main_challenge,
        application_id: app.id,
      });

      if (leadId) {
        await sendWhatsAppNotification(supabase, {
          full_name, email, phone, company: company || null,
          monthly_revenue, main_challenge, lead_id: leadId,
        });
      }
    } catch (crmErr) {
      console.error("[mastermind-submit] CRM/WhatsApp error (non-fatal):", crmErr);
    }

    return new Response(JSON.stringify({ success: true, application_id: app.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[mastermind-submit] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function resolvePipelineAndStage(supabase: any) {
  const { data: pipeline } = await supabase
    .from("crm_pipelines")
    .select("id, name")
    .eq("is_active", true)
    .ilike("name", "%MasterMind%")
    .limit(1)
    .maybeSingle();

  if (!pipeline) return null;

  const { data: stage } = await supabase
    .from("crm_stages")
    .select("id")
    .eq("pipeline_id", pipeline.id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!stage) return null;

  return { pipelineId: pipeline.id, pipelineName: pipeline.name, stageId: stage.id };
}

async function getMasterOwner(supabase: any) {
  const { data: owner } = await supabase
    .from("onboarding_staff")
    .select("id, phone")
    .eq("is_active", true)
    .in("role", ["master", "admin"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return owner;
}

async function createCrmLead(supabase: any, data: {
  full_name: string; email: string; phone: string; company: string | null;
  role: string; monthly_revenue: string; employees_count: number;
  salespeople_count: number; main_challenge: string; application_id: string;
}) {
  const pipeline = await resolvePipelineAndStage(supabase);
  if (!pipeline) {
    console.warn("[mastermind-submit] Pipeline MasterMind UNV not found");
    return null;
  }

  const owner = await getMasterOwner(supabase);

  // Dedup: check if lead with same phone in this pipeline exists
  const cleanPhone = data.phone.replace(/\D/g, "");
  const { data: existing } = await supabase
    .from("crm_leads")
    .select("id")
    .eq("pipeline_id", pipeline.pipelineId)
    .or(`phone.eq.${data.phone},phone.eq.${cleanPhone},email.eq.${data.email}`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log("[mastermind-submit] Lead already in pipeline, skipping:", existing.id);
    return existing.id;
  }

  const notes = [
    `📋 *Aplicação UNV Mastermind*`,
    `ID Aplicação: ${data.application_id}`,
    ``,
    `💰 Faturamento: ${data.monthly_revenue}`,
    `👥 Colaboradores: ${data.employees_count} | Vendedores: ${data.salespeople_count}`,
    `🎯 Desafio principal: ${data.main_challenge}`,
  ].join("\n");

  const { data: lead, error } = await supabase
    .from("crm_leads")
    .insert({
      name: data.full_name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      role: data.role,
      main_pain: data.main_challenge,
      estimated_revenue: data.monthly_revenue,
      employee_count: String(data.employees_count),
      notes,
      urgency: "high",
      opportunity_value: 50000,
      pipeline_id: pipeline.pipelineId,
      stage_id: pipeline.stageId,
      owner_staff_id: owner?.id || null,
      entered_pipeline_at: new Date().toISOString(),
      origin: "Formulário Mastermind",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[mastermind-submit] CRM lead insert error:", error);
    return null;
  }

  console.log("[mastermind-submit] CRM lead created:", lead.id);
  return lead.id;
}

function normalizeBRPhone(p: string): string {
  let clean = p.replace(/\D/g, "");
  if (clean.length === 10 || clean.length === 11) clean = "55" + clean;
  if (clean.length === 12 && clean.startsWith("55")) {
    clean = clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

async function sendWhatsAppNotification(supabase: any, data: {
  full_name: string; email: string; phone: string; company: string | null;
  monthly_revenue: string; main_challenge: string; lead_id: string;
}) {
  // Get instance name from crm_settings, fallback to "fabricionunnes"
  const { data: instanceSetting } = await supabase
    .from("crm_settings")
    .select("setting_value")
    .eq("setting_key", "lead_notification_instance_name")
    .maybeSingle();

  const notifInstanceName = (instanceSetting?.setting_value as string) || "fabricionunnes";

  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("instance_name, api_url, api_key")
    .eq("instance_name", notifInstanceName)
    .maybeSingle();

  if (!instance?.api_url || !instance?.api_key) {
    console.warn("[mastermind-submit] WhatsApp instance not found:", notifInstanceName);
    return;
  }

  const leadLink = `${APP_URL}/#/crm/leads/${data.lead_id}`;

  const message = [
    `🏆 *Nova Aplicação — UNV Mastermind!*`,
    ``,
    `👤 *Nome:* ${data.full_name}`,
    `📱 *Telefone:* ${data.phone}`,
    `📧 *Email:* ${data.email}`,
    data.company ? `🏢 *Empresa:* ${data.company}` : null,
    `💰 *Faturamento:* ${data.monthly_revenue}`,
    ``,
    `🎯 *Desafio:* ${data.main_challenge.slice(0, 200)}${data.main_challenge.length > 200 ? "..." : ""}`,
    ``,
    `🔗 *Ver no CRM:* ${leadLink}`,
  ].filter(Boolean).join("\n");

  // Get master user's phone to notify Fabrício directly
  const { data: masterStaff } = await supabase
    .from("onboarding_staff")
    .select("phone")
    .eq("is_active", true)
    .in("role", ["master"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const phonesToNotify: string[] = [];

  // Add master staff phone
  if (masterStaff?.phone) {
    const normalized = normalizeBRPhone(masterStaff.phone);
    if (normalized) phonesToNotify.push(normalized);
  }

  // Fallback: also check crm_lead_notification_numbers
  const { data: notifNumbers } = await supabase
    .from("crm_lead_notification_numbers")
    .select("phone")
    .eq("is_active", true);

  if (notifNumbers) {
    for (const n of notifNumbers) {
      const clean = normalizeBRPhone(n.phone || "");
      if (clean && !phonesToNotify.includes(clean)) phonesToNotify.push(clean);
    }
  }

  console.log("[mastermind-submit] WhatsApp notifying:", phonesToNotify);

  for (const phone of phonesToNotify) {
    try {
      const resp = await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: instance.api_key },
        body: JSON.stringify({ number: phone, text: message }),
      });
      console.log(`[mastermind-submit] WhatsApp to ${phone}: ${resp.status}`);
    } catch (err) {
      console.error(`[mastermind-submit] WhatsApp error for ${phone}:`, err);
    }
  }
}

async function handleBackfill(supabase: any) {
  try {
    const pipeline = await resolvePipelineAndStage(supabase);
    if (!pipeline) {
      return new Response(JSON.stringify({ error: "Pipeline MasterMind UNV não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const owner = await getMasterOwner(supabase);

    // Get all existing applications
    const { data: apps } = await supabase
      .from("mastermind_applications")
      .select("*")
      .order("created_at", { ascending: true });

    if (!apps?.length) {
      return new Response(JSON.stringify({ success: true, processed: 0, created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let created = 0;
    let skipped = 0;

    for (const app of apps) {
      const cleanPhone = (app.phone || "").replace(/\D/g, "");

      // Check if already exists in pipeline
      const { data: existing } = await supabase
        .from("crm_leads")
        .select("id")
        .eq("pipeline_id", pipeline.pipelineId)
        .or(`phone.eq.${app.phone},phone.eq.${cleanPhone},email.eq.${app.email}`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const notes = [
        `📋 *Aplicação UNV Mastermind*`,
        `ID Aplicação: ${app.id}`,
        `Data: ${app.created_at?.slice(0, 10)}`,
        ``,
        `💰 Faturamento: ${app.monthly_revenue}`,
        `👥 Colaboradores: ${app.employees_count} | Vendedores: ${app.salespeople_count}`,
        `🎯 Desafio: ${app.main_challenge}`,
      ].join("\n");

      const { error } = await supabase
        .from("crm_leads")
        .insert({
          name: app.full_name,
          email: app.email,
          phone: app.phone,
          company: app.company || null,
          role: app.role_other || app.role || null,
          main_pain: app.main_challenge || null,
          estimated_revenue: app.monthly_revenue || null,
          employee_count: app.employees_count ? String(app.employees_count) : null,
          notes,
          urgency: "high",
          opportunity_value: 50000,
          pipeline_id: pipeline.pipelineId,
          stage_id: pipeline.stageId,
          owner_staff_id: owner?.id || null,
          entered_pipeline_at: app.created_at || new Date().toISOString(),
          created_at: app.created_at || new Date().toISOString(),
          origin: "Formulário Mastermind",
        });

      if (error) {
        console.error("[mastermind-submit backfill] Insert error for app", app.id, error.message);
      } else {
        created++;
      }
    }

    console.log(`[mastermind-submit backfill] Done: created=${created}, skipped=${skipped}`);
    return new Response(JSON.stringify({ success: true, processed: apps.length, created, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
