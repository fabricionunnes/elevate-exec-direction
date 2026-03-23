import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const body = await req.json();
    const {
      form_token, nome, telefone, email, empresa, desafio,
      utm_source, utm_medium, utm_campaign, utm_content
    } = body;

    if (!form_token) {
      return new Response(JSON.stringify({ error: 'Token do formulário é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Get form config
    const { data: form } = await supabase
      .from('crm_pipeline_forms')
      .select('id, pipeline_id, origin_name, is_active')
      .eq('form_token', form_token)
      .maybeSingle();

    if (!form || !form.is_active) {
      return new Response(JSON.stringify({ error: 'Formulário não encontrado ou inativo' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get first stage
    const { data: stage } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('pipeline_id', form.pipeline_id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!stage) {
      return new Response(JSON.stringify({ error: 'Pipeline sem etapas configuradas' }), {
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
    const originName = form.origin_name || 'Formulário Público';
    const { data: origin } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', `%${originName}%`)
      .limit(1)
      .maybeSingle();

    const notesParts = [];
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
        phone: telefone,
        email: email,
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
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[submit-pipeline-form] Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Erro ao criar lead' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[submit-pipeline-form] Lead created:', lead.id);

    // Send WhatsApp notification
    const APP_URL = 'https://elevate-exec-direction.lovable.app';
    const leadLink = `${APP_URL}/#/crm/leads/${lead.id}`;

    const message = `🚀 *Novo Lead via Formulário!*\n\n` +
      `👤 *Nome:* ${nome}\n` +
      `📞 *Telefone:* ${telefone}\n` +
      `📧 *Email:* ${email}\n` +
      (empresa ? `🏢 *Empresa:* ${empresa}\n` : '') +
      (desafio ? `🎯 *Desafio:* ${desafio}\n` : '') +
      (utm_source ? `📊 *Origem:* ${utm_source}\n` : '') +
      `\n🔗 *Ver no CRM:* ${leadLink}`;

    const { data: whatsappConfig } = await supabase
      .from('whatsapp_default_config')
      .select('setting_value')
      .eq('setting_key', 'default_instance')
      .maybeSingle();

    const instanceName = whatsappConfig?.setting_value;

    if (instanceName) {
      const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

      if (evolutionUrl && evolutionKey) {
        const numbersToNotify: string[] = [];

        if (owner?.phone) {
          const cleanPhone = owner.phone.replace(/\D/g, '');
          if (cleanPhone) numbersToNotify.push(cleanPhone);
        }

        const { data: notifNumbers } = await supabase
          .from('crm_lead_notification_numbers')
          .select('phone')
          .eq('is_active', true);

        if (notifNumbers) {
          for (const n of notifNumbers) {
            const cleanPhone = n.phone.replace(/\D/g, '');
            if (cleanPhone && !numbersToNotify.includes(cleanPhone)) {
              numbersToNotify.push(cleanPhone);
            }
          }
        }

        for (const phone of numbersToNotify) {
          try {
            await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
              body: JSON.stringify({ number: phone, text: message }),
            });
          } catch (e) {
            console.error(`[submit-pipeline-form] WhatsApp error for ${phone}:`, e);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, lead_id: lead.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[submit-pipeline-form] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
