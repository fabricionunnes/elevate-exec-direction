import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Action: submit answers for an existing lead ──
    if (body.action === 'submit_answers') {
      const { lead_id, answers } = body;
      if (!lead_id || !answers || !Array.isArray(answers)) {
        return jsonResponse({ error: 'lead_id e answers são obrigatórios' }, 400);
      }

      const rows = answers.map((a: { question_id: string; answer_text: string }) => ({
        lead_id,
        question_id: a.question_id,
        answer_text: a.answer_text,
      }));

      if (rows.length > 0) {
        // Delete previous answers for this lead before inserting new ones
        await supabase.from('crm_lead_form_answers').delete().eq('lead_id', lead_id);

        const { error: insertErr } = await supabase.from('crm_lead_form_answers').insert(rows);
        if (insertErr) {
          console.error('[submit-pipeline-form] Answers insert error:', insertErr);
          return jsonResponse({ error: 'Erro ao salvar respostas' }, 500);
        }
      }

      // Update lead notes with answers
      const { data: answersData } = await supabase
        .from('crm_lead_form_answers')
        .select('answer_text, question_id')
        .eq('lead_id', lead_id);

      if (answersData && answersData.length > 0) {
        const questionIds = answersData.map((a: any) => a.question_id);
        const { data: questionsData } = await supabase
          .from('crm_pipeline_form_questions')
          .select('id, question_text')
          .in('id', questionIds);

        if (questionsData) {
          const qMap = new Map(questionsData.map((q: any) => [q.id, q.question_text]));
          const answerNotes = answersData
            .map((a: any) => `${qMap.get(a.question_id) || 'Pergunta'}: ${a.answer_text}`)
            .join(' | ');

          // Append to existing notes
          const { data: lead } = await supabase
            .from('crm_leads')
            .select('notes')
            .eq('id', lead_id)
            .single();

          const existingNotes = lead?.notes || '';
          const newNotes = existingNotes
            ? `${existingNotes} | ${answerNotes}`
            : answerNotes;

          await supabase
            .from('crm_leads')
            .update({ notes: newNotes })
            .eq('id', lead_id);
        }
      }

      // ── Move lead to "Triagem" stage (second stage) ──
      const { data: leadData } = await supabase
        .from('crm_leads')
        .select('pipeline_id')
        .eq('id', lead_id)
        .single();

      if (leadData) {
        const { data: triagemStage } = await supabase
          .from('crm_stages')
          .select('id')
          .eq('pipeline_id', leadData.pipeline_id)
          .order('sort_order', { ascending: true })
          .range(1, 1)
          .maybeSingle();

        if (triagemStage) {
          await supabase
            .from('crm_leads')
            .update({ stage_id: triagemStage.id })
            .eq('id', lead_id);

          // Log stage transition
          await supabase.from('crm_lead_stage_history').insert({
            lead_id,
            from_stage_id: null,
            to_stage_id: triagemStage.id,
            changed_by_staff_id: null,
          }).then(() => {});
        }

        // ── Notify master, head_comercial, SDR ──
        const { data: leadInfo } = await supabase
          .from('crm_leads')
          .select('name, email, company')
          .eq('id', lead_id)
          .single();

        if (leadInfo) {
          await sendInternalNotifications(
            supabase, lead_id,
            leadInfo.name, leadInfo.email,
            leadInfo.company || undefined,
            'Formulário Sessão Estratégica'
          );
        }
      }

      return jsonResponse({ success: true });
    }

    // ── Default action: create lead (step 1) ──
    const {
      form_token, nome, telefone, email, empresa, desafio,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, ad_name, adset_name, campaign_name,
      meta_campaign_id, meta_adset_id, meta_ad_id,
    } = body;

    if (!form_token) return jsonResponse({ error: 'Token do formulário é obrigatório' }, 400);
    if (!nome || !telefone || !email) return jsonResponse({ error: 'Campos obrigatórios: nome, telefone, email' }, 400);

    const { data: form } = await supabase
      .from('crm_pipeline_forms')
      .select('id, pipeline_id, origin_name, is_active')
      .eq('form_token', form_token)
      .maybeSingle();

    if (!form || !form.is_active) return jsonResponse({ error: 'Formulário não encontrado ou inativo' }, 404);

    // Fetch pipeline name
    const { data: pipelineData } = await supabase
      .from('crm_pipelines')
      .select('name')
      .eq('id', form.pipeline_id)
      .maybeSingle();
    const pipelineName = pipelineData?.name || 'Desconhecido';

    // ── Check for existing lead by email or phone in the same pipeline ──
    const cleanPhone = telefone.replace(/\D/g, '');
    const { data: existingLead } = await supabase
      .from('crm_leads')
      .select('id, pipeline_id, stage_id, tenant_id')
      .eq('pipeline_id', form.pipeline_id)
      .or(`email.eq.${email},phone.eq.${cleanPhone}`)
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      // Lead already exists — update name/phone/email but keep current stage
      const reentryAt = new Date().toISOString();
      const { data: entryStage } = await supabase
        .from('crm_stages')
        .select('id')
        .eq('pipeline_id', form.pipeline_id)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      await supabase
        .from('crm_leads')
        .update({
          name: nome,
          phone: cleanPhone,
          email,
          entered_pipeline_at: reentryAt,
          ...(empresa ? { company: empresa } : {}),
          ...(desafio ? { main_pain: desafio } : {}),
        })
        .eq('id', existingLead.id);

      await reenrollApplicableCadences(supabase, {
        leadId: existingLead.id,
        pipelineId: existingLead.pipeline_id || form.pipeline_id,
        stageId: entryStage?.id || existingLead.stage_id,
        tenantId: existingLead.tenant_id,
        nowIso: reentryAt,
      });

      console.log('[submit-pipeline-form] Existing lead updated:', existingLead.id);

      // Still send notifications for returning leads
      const originName = form.origin_name || 'Formulário Público';
      await sendInternalNotifications(supabase, existingLead.id, nome, email, empresa, originName);

      const { data: owner } = await supabase
        .from('onboarding_staff')
        .select('id, phone')
        .eq('is_active', true)
        .in('role', ['master', 'admin'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      await sendWhatsAppNotification(supabase, existingLead.id, nome, telefone, email, empresa, desafio, utm_source, owner, pipelineName);

      return jsonResponse({ success: true, lead_id: existingLead.id });
    }

    // ── New lead: create normally ──
    const { data: stage } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('pipeline_id', form.pipeline_id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!stage) return jsonResponse({ error: 'Pipeline sem etapas configuradas' }, 500);

    const { data: owner } = await supabase
      .from('onboarding_staff')
      .select('id, phone')
      .eq('is_active', true)
      .in('role', ['master', 'admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const originName = form.origin_name || 'Formulário Público';
    
    // Try to find matching origin: first by pipeline_id (most reliable), then by name similarity
    let origin: { id: string } | null = null;
    
    // 1. Best match: origin linked to the same pipeline
    const { data: pipelineOrigin } = await supabase
      .from('crm_origins')
      .select('id')
      .eq('pipeline_id', form.pipeline_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    
    if (pipelineOrigin) {
      origin = pipelineOrigin;
    } else {
      // 2. Fallback: match by name (try exact, then partial)
      const { data: exactOrigin } = await supabase
        .from('crm_origins')
        .select('id')
        .ilike('name', originName)
        .limit(1)
        .maybeSingle();
      
      if (exactOrigin) {
        origin = exactOrigin;
      } else {
        // 3. Try matching origin name contained in originName or vice-versa
        const { data: allOrigins } = await supabase
          .from('crm_origins')
          .select('id, name')
          .eq('is_active', true);
        
        if (allOrigins) {
          const matched = allOrigins.find((o: { id: string; name: string }) => 
            originName.toLowerCase().includes(o.name.toLowerCase()) || 
            o.name.toLowerCase().includes(originName.toLowerCase())
          );
          if (matched) origin = { id: matched.id };
        }
      }
    }

    const notesParts: string[] = [];
    if (desafio) notesParts.push(`Desafio: ${desafio}`);
    if (utm_source) notesParts.push(`UTM Source: ${utm_source}`);
    if (utm_medium) notesParts.push(`UTM Medium: ${utm_medium}`);
    if (utm_campaign) notesParts.push(`UTM Campaign: ${utm_campaign}`);
    notesParts.push(`Origem: ${originName}`);
    const notes = notesParts.join(' | ');

    const { data: lead, error: insertError } = await supabase
      .from('crm_leads')
      .insert({
        name: nome,
        phone: cleanPhone,
        email,
        company: empresa || null,
        main_pain: desafio || null,
        notes,
        urgency: 'medium',
        pipeline_id: form.pipeline_id,
        stage_id: stage.id,
        owner_staff_id: owner?.id || null,
        origin_id: origin?.id || null,
        entered_pipeline_at: new Date().toISOString(),
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_content: utm_content || null,
        fbclid: fbclid || null,
        ad_name: ad_name || null,
        adset_name: adset_name || null,
        campaign_name: campaign_name || null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[submit-pipeline-form] Insert error:', insertError);
      return jsonResponse({ error: 'Erro ao criar lead' }, 500);
    }

    console.log('[submit-pipeline-form] Lead created:', lead.id);

    // ── Internal notifications for head_comercial, sdr, master ──
    await sendInternalNotifications(supabase, lead.id, nome, email, empresa, originName);

    // ── WhatsApp notification ──
    await sendWhatsAppNotification(supabase, lead.id, nome, telefone, email, empresa, desafio, utm_source, owner, pipelineName);

    // ── Fire automation engine for lead_created ──
    try {
      await supabase.functions.invoke("automation-engine", {
        body: {
          trigger_type: "lead_created",
          trigger_data: {
            lead_id: lead.id,
            lead_name: nome,
            lead_phone: cleanPhone,
            company_name: empresa || "",
            pipeline_id: form.pipeline_id,
          },
        },
      });
    } catch (autoErr) {
      console.error("[submit-pipeline-form] Automation engine error:", autoErr);
    }

    // ── Enqueue CRM message rules (régua de mensagens para o cliente) ──
    try {
      await supabase.functions.invoke("crm-message-queue", {
        body: {
          action: "enqueue",
          trigger_type: "lead_created",
          lead_id: lead.id,
          lead_name: nome,
          lead_phone: cleanPhone,
          lead_email: email || "",
          company_name: empresa || "",
          pipeline_id: form.pipeline_id,
          pipeline_name: pipelineName,
          stage_id: stage.id,
          stage_name: "",
        },
      });
    } catch (queueErr) {
      console.error("[submit-pipeline-form] Message queue error:", queueErr);
    }

    return jsonResponse({ success: true, lead_id: lead.id });

  } catch (error: unknown) {
    console.error('[submit-pipeline-form] Error:', error);
    return jsonResponse({ error: String(error) }, 500);
  }
});

async function sendInternalNotifications(
  supabase: any, leadId: string,
  nome: string, email: string,
  empresa?: string, originName?: string
) {
  try {
    const { data: staffToNotify } = await supabase
      .from('onboarding_staff')
      .select('id')
      .eq('is_active', true)
      .in('role', ['master', 'head_comercial', 'sdr']);

    if (!staffToNotify || staffToNotify.length === 0) return;

    const title = `🚀 Novo Lead: ${nome}`;
    const message = `Novo lead via formulário: ${nome}` +
      (empresa ? ` | Empresa: ${empresa}` : '') +
      ` | Email: ${email}` +
      (originName ? ` | Origem: ${originName}` : '');

    const notifications = staffToNotify.map((s: { id: string }) => ({
      staff_id: s.id,
      type: 'new_lead',
      title,
      message,
      reference_id: leadId,
      reference_type: 'lead',
    }));

    const { error } = await supabase.from('onboarding_notifications').insert(notifications);
    if (error) console.error('[submit-pipeline-form] Notification insert error:', error);
  } catch (e) {
    console.error('[submit-pipeline-form] Internal notification error:', e);
  }
}

function calcCadenceNextRun(now: Date, delayValue?: number | null, delayUnit?: string | null) {
  const safeValue = Number.isFinite(delayValue) ? Number(delayValue) : 0;
  const delayMs = delayUnit === 'minutes'
    ? safeValue * 60 * 1000
    : delayUnit === 'hours'
      ? safeValue * 60 * 60 * 1000
      : safeValue * 24 * 60 * 60 * 1000;

  return new Date(now.getTime() + delayMs);
}

async function reenrollApplicableCadences(
  supabase: any,
  params: { leadId: string; pipelineId: string; stageId?: string | null; tenantId?: string | null; nowIso: string }
) {
  const { leadId, pipelineId, stageId, tenantId, nowIso } = params;
  const now = new Date(nowIso);

  const queries = [
    supabase
      .from('crm_cadences')
      .select('id')
      .eq('is_active', true)
      .eq('scope', 'pipeline')
      .eq('pipeline_id', pipelineId),
  ];

  if (stageId) {
    queries.push(
      supabase
        .from('crm_cadences')
        .select('id')
        .eq('is_active', true)
        .eq('scope', 'stage')
        .eq('stage_id', stageId)
    );
  }

  const results = await Promise.all(queries);
  const cadenceIds = [...new Set(results.flatMap((r: any) => (r.data || []).map((c: any) => c.id)))];

  for (const cadenceId of cadenceIds) {
    const { data: currentEnrollment } = await supabase
      .from('crm_cadence_enrollments')
      .select('id, status')
      .eq('cadence_id', cadenceId)
      .eq('lead_id', leadId)
      .maybeSingle();

    if (currentEnrollment?.status === 'active' || currentEnrollment?.status === 'paused') {
      continue;
    }

    const { data: firstStep } = await supabase
      .from('crm_cadence_steps')
      .select('delay_value, delay_unit')
      .eq('cadence_id', cadenceId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!firstStep) continue;

    const nextRunAt = calcCadenceNextRun(now, firstStep.delay_value, firstStep.delay_unit).toISOString();
    const resetPayload = {
      current_step_index: 0,
      status: 'active',
      next_run_at: nextRunAt,
      enrolled_at: nowIso,
      completed_at: null,
      stopped_reason: null,
      last_message_sent_at: null,
      last_inbound_at: null,
      last_inbound_text: null,
    };

    if (currentEnrollment?.id) {
      const { error } = await supabase
        .from('crm_cadence_enrollments')
        .update(resetPayload)
        .eq('id', currentEnrollment.id);

      if (error) {
        console.error('[submit-pipeline-form] Cadence reenroll update error:', { cadenceId, leadId, error });
      }
      continue;
    }

    const { error } = await supabase
      .from('crm_cadence_enrollments')
      .insert({
        cadence_id: cadenceId,
        lead_id: leadId,
        ...resetPayload,
        tenant_id: tenantId || null,
      });

    if (error) {
      console.error('[submit-pipeline-form] Cadence reenroll insert error:', { cadenceId, leadId, error });
    }
  }
}

async function sendWhatsAppNotification(
  supabase: any, leadId: string,
  nome: string, telefone: string, email: string,
  empresa?: string, desafio?: string, utm_source?: string,
  owner?: { id: string; phone: string | null } | null,
  pipelineName?: string
) {
  const APP_URL = 'https://elevate-exec-direction.lovable.app';
  const leadLink = `${APP_URL}/#/crm/leads/${leadId}`;

  const message = `📋 *${nome}* preencheu o formulário no funil *${pipelineName || 'Desconhecido'}*.\n\n🔗 ${leadLink}`;

  // Read configured instance from crm_settings, fallback to "fabricionunnes"
  const { data: instanceSetting } = await supabase
    .from('crm_settings')
    .select('setting_value')
    .eq('setting_key', 'lead_notification_instance_name')
    .maybeSingle();

  const instanceName = (instanceSetting?.setting_value as string) || 'fabricionunnes';
  if (!instanceName) {
    console.log('[submit-pipeline-form] Lead notification instance not configured, skipping');
    return;
  }

  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('instance_name, api_url, api_key')
    .eq('instance_name', instanceName)
    .maybeSingle();

  if (!instance?.api_url || !instance?.api_key || !instance?.instance_name) {
    console.warn('[submit-pipeline-form] Fabricio Nunnes WhatsApp instance not found or missing credentials');
    return;
  }

  // Get phone numbers from staff with roles: master, head_comercial, sdr
  const { data: staffNumbers } = await supabase
    .from('onboarding_staff')
    .select('phone')
    .eq('is_active', true)
    .in('role', ['master', 'head_comercial', 'sdr'])
    .not('phone', 'is', null);

  const numbersToNotify: string[] = [];

  const normalizeBRPhone = (p: string) => {
    let clean = p.replace(/\D/g, '');
    if (clean.length === 10 || clean.length === 11) clean = '55' + clean;
    if (clean.length === 12 && clean.startsWith('55')) {
      clean = clean.slice(0, 4) + '9' + clean.slice(4);
    }
    return clean;
  };

  console.log('[submit-pipeline-form] Staff numbers raw:', JSON.stringify(staffNumbers));

  if (staffNumbers) {
    for (const s of staffNumbers) {
      const clean = normalizeBRPhone(s.phone || '');
      if (clean && !numbersToNotify.includes(clean)) numbersToNotify.push(clean);
    }
  }

  // Also include crm_lead_notification_numbers as fallback
  const { data: notifNumbers } = await supabase
    .from('crm_lead_notification_numbers')
    .select('phone')
    .eq('is_active', true);

  if (notifNumbers) {
    for (const n of notifNumbers) {
      const clean = normalizeBRPhone(n.phone || '');
      if (clean && !numbersToNotify.includes(clean)) numbersToNotify.push(clean);
    }
  }

  console.log('[submit-pipeline-form] Numbers to notify:', numbersToNotify);

  for (const phone of numbersToNotify) {
    const sendUrl = `${instance.api_url}/message/sendText/${instance.instance_name}`;
    const payload = JSON.stringify({ number: phone, text: message });
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[submit-pipeline-form] Sending WhatsApp to ${phone} (attempt ${attempt}) via ${sendUrl}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const resp = await fetch(sendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': instance.api_key },
          body: payload,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const respText = await resp.text();
        console.log(`[submit-pipeline-form] WhatsApp response for ${phone}: ${resp.status} - ${respText.slice(0, 200)}`);
        break; // success, no retry needed
      } catch (e) {
        console.error(`[submit-pipeline-form] WhatsApp error for ${phone} (attempt ${attempt}):`, e);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1500)); // wait 1.5s before retry
        }
      }
    }
  }
}
