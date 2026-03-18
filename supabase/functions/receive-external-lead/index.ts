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
    // Authenticate via x-api-key header
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('EXTERNAL_LEAD_API_KEY');

    if (!expectedKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { nome, telefone, email, empresa, faturamento, qtd_vendedores, desafio, tag } = body;

    // Validate required fields
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

    // Get "Funil SE" pipeline specifically
    const { data: pipeline } = await supabase
      .from('crm_pipelines')
      .select('id')
      .eq('is_active', true)
      .ilike('name', '%Funil SE%')
      .limit(1)
      .maybeSingle();

    if (!pipeline) {
      return new Response(JSON.stringify({ error: 'Pipeline "Funil SE" não encontrado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: stage } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('pipeline_id', pipeline.id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!stage) {
      return new Response(JSON.stringify({ error: 'Nenhuma etapa encontrada no pipeline' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get first active admin/master staff as owner
    const { data: owner } = await supabase
      .from('onboarding_staff')
      .select('id, phone')
      .eq('is_active', true)
      .in('role', ['master', 'admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Try to find origin "Landing Page"
    const { data: origin } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', '%Landing Page%')
      .limit(1)
      .maybeSingle();

    // Build notes
    const notesParts = [];
    if (faturamento) notesParts.push(`Faturamento: ${faturamento}`);
    if (qtd_vendedores) notesParts.push(`Vendedores: ${qtd_vendedores}`);
    if (tag) notesParts.push(`Tag: ${tag}`);
    notesParts.push('Origem: Landing Page Diagnóstico');
    const notes = notesParts.join(' | ');

    const urgency = tag === 'PRIORIDADE' ? 'high' : 'medium';

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
        pipeline_id: pipeline.id,
        stage_id: stage.id,
        owner_staff_id: owner?.id || null,
        origin_id: origin?.id || null,
        entered_pipeline_at: new Date().toISOString(),
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

    const message = `🚀 *Novo Lead Externo!*\n\n` +
      `👤 *Nome:* ${nome}\n` +
      `📞 *Telefone:* ${telefone}\n` +
      `📧 *Email:* ${email}\n` +
      (empresa ? `🏢 *Empresa:* ${empresa}\n` : '') +
      (faturamento ? `💰 *Faturamento:* ${faturamento}\n` : '') +
      (qtd_vendedores ? `👥 *Vendedores:* ${qtd_vendedores}\n` : '') +
      (desafio ? `🎯 *Desafio:* ${desafio}\n` : '') +
      (tag ? `🏷️ *Tag:* ${tag}\n` : '') +
      `\n🔗 *Ver no CRM:* ${leadLink}`;

    // Get WhatsApp instance
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
        // Collect numbers to notify
        const numbersToNotify: string[] = [];

        // 1. Owner staff phone
        if (owner?.phone) {
          const cleanPhone = owner.phone.replace(/\D/g, '');
          if (cleanPhone) numbersToNotify.push(cleanPhone);
        }

        // 2. Numbers from notification table
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

        // Send to each number
        for (const phone of numbersToNotify) {
          try {
            const sendUrl = `${evolutionUrl}/message/sendText/${instanceName}`;
            await fetch(sendUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionKey,
              },
              body: JSON.stringify({
                number: phone,
                text: message,
              }),
            });
            console.log(`[receive-external-lead] WhatsApp sent to ${phone}`);
          } catch (whatsappError) {
            console.error(`[receive-external-lead] WhatsApp error for ${phone}:`, whatsappError);
          }
        }
      } else {
        console.warn('[receive-external-lead] Evolution API not configured, skipping WhatsApp');
      }
    } else {
      console.warn('[receive-external-lead] No WhatsApp instance configured');
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
