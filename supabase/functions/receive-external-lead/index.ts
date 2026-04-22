import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('EXTERNAL_LEAD_API_KEY');

    if (!expectedKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      nome, telefone, email, empresa, faturamento, qtd_vendedores, desafio, tag,
      pipeline_id, pipeline_name, origin_name,
      utm_source, utm_medium, utm_campaign, utm_content
    } = body;

    if (!nome || !telefone || !email) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: nome, telefone, email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Resolve pipeline: by id, by name, or fallback to "Funil SE"
    let resolvedPipelineId: string | null = null;

    if (pipeline_id) {
      const { data: p } = await supabase
        .from('crm_pipelines')
        .select('id')
        .eq('id', pipeline_id)
        .eq('is_active', true)
        .maybeSingle();
      resolvedPipelineId = p?.id || null;
    }

    if (!resolvedPipelineId && pipeline_name) {
      const { data: p } = await supabase
        .from('crm_pipelines')
        .select('id')
        .eq('is_active', true)
        .ilike('name', `%${pipeline_name}%`)
        .limit(1)
        .maybeSingle();
      resolvedPipelineId = p?.id || null;
    }

    if (!resolvedPipelineId) {
      const { data: p } = await supabase
        .from('crm_pipelines')
        .select('id')
        .eq('is_active', true)
        .ilike('name', '%Funil SE%')
        .limit(1)
        .maybeSingle();
      resolvedPipelineId = p?.id || null;
    }

    if (!resolvedPipelineId) {
      return new Response(JSON.stringify({ error: 'Pipeline não encontrado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get pipeline name
    const { data: pipelineData } = await supabase
      .from('crm_pipelines')
      .select('name')
      .eq('id', resolvedPipelineId)
      .maybeSingle();
    const resolvedPipelineName = pipelineData?.name || 'Desconhecido';

    // Get first stage of pipeline
    const { data: stage } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('pipeline_id', resolvedPipelineId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!stage) {
      return new Response(JSON.stringify({ error: 'Nenhuma etapa encontrada no pipeline' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get owner
    const { data: owner } = await supabase
      .from('onboarding_staff')
      .select('id, phone')
      .eq('is_active', true)
      .in('role', ['master', 'admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Resolve origin
    const searchOriginName = origin_name || 'Landing Page';
    const { data: origin } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', `%${searchOriginName}%`)
      .limit(1)
      .maybeSingle();

    // Build notes
    const notesParts = [];
    if (faturamento) notesParts.push(`Faturamento: ${faturamento}`);
    if (qtd_vendedores) notesParts.push(`Vendedores: ${qtd_vendedores}`);
    if (tag) notesParts.push(`Tag: ${tag}`);
    if (utm_source) notesParts.push(`UTM Source: ${utm_source}`);
    if (utm_medium) notesParts.push(`UTM Medium: ${utm_medium}`);
    if (utm_campaign) notesParts.push(`UTM Campaign: ${utm_campaign}`);
    notesParts.push(`Origem: ${searchOriginName}`);
    const notes = notesParts.join(' | ');

    const urgency = tag === 'PRIORIDADE' ? 'high' : 'medium';

    // === Deduplication: check if lead with same phone + pipeline was created in last 24h ===
    const cleanPhone = telefone.replace(/\D/g, '');
    const dedup24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingLead } = await supabase
      .from('crm_leads')
      .select('id')
      .eq('pipeline_id', resolvedPipelineId)
      .gte('created_at', dedup24h)
      .or(`phone.eq.${telefone},phone.eq.${cleanPhone},phone.ilike.%${cleanPhone.slice(-8)}%`)
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      console.log('[receive-external-lead] Duplicate detected, returning existing lead:', existingLead.id);
      return new Response(JSON.stringify({ success: true, lead_id: existingLead.id, deduplicated: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert lead
    const { data: lead, error: insertError } = await supabase
      .from('crm_leads')
      .insert({
        name: nome,
        phone: telefone,
        email: email,
        company: empresa || null,
        main_pain: desafio || null,
        notes: notes,
        urgency: urgency,
        pipeline_id: resolvedPipelineId,
        stage_id: stage.id,
        owner_staff_id: owner?.id || null,
        origin_id: origin?.id || null,
        entered_pipeline_at: new Date().toISOString(),
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_content: utm_content || null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[receive-external-lead] Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Erro ao inserir lead', details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[receive-external-lead] Lead created:', lead.id);

    // === Send WhatsApp notifications ===
    const APP_URL = 'https://elevate-exec-direction.lovable.app';
    const leadLink = `${APP_URL}/#/crm/leads/${lead.id}`;

    const formatBRPhone = (raw: string) => {
      if (!raw) return raw;
      const digits = String(raw).replace(/\D/g, '');
      let hasDDI = false;
      let clean = digits;
      if (digits.startsWith('55') && digits.length >= 12) {
        hasDDI = true;
        clean = digits.slice(2);
      }
      let formatted = raw;
      if (clean.length === 11) {
        formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
      } else if (clean.length === 10) {
        formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
      }
      return hasDDI ? `+55 ${formatted}` : formatted;
    };

    const message = `🚀 *Novo Lead Externo!*\n\n` +
      `📊 *Funil:* ${resolvedPipelineName}\n` +
      `👤 *Nome:* ${nome}\n` +
      `📞 *Telefone:* ${formatBRPhone(telefone)}\n` +
      `📧 *Email:* ${email}\n` +
      (empresa ? `🏢 *Empresa:* ${empresa}\n` : '') +
      (faturamento ? `💰 *Faturamento:* ${faturamento}\n` : '') +
      (qtd_vendedores ? `👥 *Vendedores:* ${qtd_vendedores}\n` : '') +
      (desafio ? `🎯 *Desafio:* ${desafio}\n` : '') +
      (tag ? `🏷️ *Tag:* ${tag}\n` : '') +
      (utm_source ? `📊 *Origem:* ${utm_source}\n` : '') +
      `\n🔗 *Ver no CRM:* ${leadLink}`;

    // Read configured instance from crm_settings, fallback to "fabricionunnes"
    const { data: instanceSetting } = await supabase
      .from('crm_settings')
      .select('setting_value')
      .eq('setting_key', 'lead_notification_instance_name')
      .maybeSingle();

    const notifInstanceName = (instanceSetting?.setting_value as string) || 'fabricionunnes';

    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, api_url, api_key')
      .eq('instance_name', notifInstanceName)
      .maybeSingle();

    if (instance?.api_url && instance?.api_key && instance?.instance_name) {
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
          const cleanPhone = normalizeBRPhone(n.phone || '');
          if (cleanPhone && !numbersToNotify.includes(cleanPhone)) {
            numbersToNotify.push(cleanPhone);
          }
        }
      }

      console.log('[receive-external-lead] Numbers to notify:', numbersToNotify);

      for (const phone of numbersToNotify) {
        try {
          const sendUrl = `${instance.api_url}/message/sendText/${instance.instance_name}`;
          const resp = await fetch(sendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': instance.api_key,
            },
            body: JSON.stringify({ number: phone, text: message }),
          });
          console.log(`[receive-external-lead] WhatsApp sent to ${phone}: ${resp.status}`);
        } catch (whatsappError) {
          console.error(`[receive-external-lead] WhatsApp error for ${phone}:`, whatsappError);
        }
      }
    } else {
      console.warn('[receive-external-lead] Fabricio Nunnes WhatsApp instance not found');
    }

    // === Fire automation engine for lead_created ===
    try {
      await supabase.functions.invoke("automation-engine", {
        body: {
          trigger_type: "lead_created",
          trigger_data: {
            lead_id: lead.id,
            lead_name: nome,
            lead_phone: telefone,
            company_name: empresa || "",
            pipeline_id: resolvedPipelineId,
            pipeline_name: resolvedPipelineName,
          },
        },
      });
    } catch (autoErr) {
      console.error("[receive-external-lead] Automation engine error:", autoErr);
    }

    // === Enqueue CRM message rules (régua de mensagens para o cliente) ===
    try {
      await supabase.functions.invoke("crm-message-queue", {
        body: {
          action: "enqueue",
          trigger_type: "lead_created",
          lead_id: lead.id,
          lead_name: nome,
          lead_phone: telefone,
          lead_email: email || "",
          company_name: empresa || "",
          pipeline_id: resolvedPipelineId,
          pipeline_name: resolvedPipelineName,
          stage_id: stage.id,
          stage_name: "",
        },
      });
    } catch (queueErr) {
      console.error("[receive-external-lead] Message queue error:", queueErr);
    }

    return new Response(JSON.stringify({ success: true, lead_id: lead.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[receive-external-lead] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
