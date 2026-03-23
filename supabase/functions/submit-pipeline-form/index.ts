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

      return jsonResponse({ success: true });
    }

    // ── Default action: create lead (step 1) ──
    const {
      form_token, nome, telefone, email, empresa, desafio,
      utm_source, utm_medium, utm_campaign, utm_content
    } = body;

    if (!form_token) return jsonResponse({ error: 'Token do formulário é obrigatório' }, 400);
    if (!nome || !telefone || !email) return jsonResponse({ error: 'Campos obrigatórios: nome, telefone, email' }, 400);

    const { data: form } = await supabase
      .from('crm_pipeline_forms')
      .select('id, pipeline_id, origin_name, is_active')
      .eq('form_token', form_token)
      .maybeSingle();

    if (!form || !form.is_active) return jsonResponse({ error: 'Formulário não encontrado ou inativo' }, 404);

    // ── Check for existing lead by email or phone in the same pipeline ──
    const cleanPhone = telefone.replace(/\D/g, '');
    const { data: existingLead } = await supabase
      .from('crm_leads')
      .select('id')
      .eq('pipeline_id', form.pipeline_id)
      .or(`email.eq.${email},phone.eq.${cleanPhone}`)
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      // Lead already exists — update name/phone/email but keep current stage
      await supabase
        .from('crm_leads')
        .update({
          name: nome,
          phone: cleanPhone,
          email,
          ...(empresa ? { company: empresa } : {}),
          ...(desafio ? { main_pain: desafio } : {}),
        })
        .eq('id', existingLead.id);

      console.log('[submit-pipeline-form] Existing lead updated:', existingLead.id);
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
    const { data: origin } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', `%${originName}%`)
      .limit(1)
      .maybeSingle();

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
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[submit-pipeline-form] Insert error:', insertError);
      return jsonResponse({ error: 'Erro ao criar lead' }, 500);
    }

    console.log('[submit-pipeline-form] Lead created:', lead.id);

    // ── WhatsApp notification ──
    await sendWhatsAppNotification(supabase, lead.id, nome, telefone, email, empresa, desafio, utm_source, owner);

    return jsonResponse({ success: true, lead_id: lead.id });

  } catch (error: unknown) {
    console.error('[submit-pipeline-form] Error:', error);
    return jsonResponse({ error: String(error) }, 500);
  }
});

async function sendWhatsAppNotification(
  supabase: any, leadId: string,
  nome: string, telefone: string, email: string,
  empresa?: string, desafio?: string, utm_source?: string,
  owner?: { id: string; phone: string | null } | null
) {
  const APP_URL = 'https://elevate-exec-direction.lovable.app';
  const leadLink = `${APP_URL}/#/crm/leads/${leadId}`;

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
  if (!instanceName) return;

  const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
  if (!evolutionUrl || !evolutionKey) return;

  const numbersToNotify: string[] = [];

  if (owner?.phone) {
    const clean = owner.phone.replace(/\D/g, '');
    if (clean) numbersToNotify.push(clean);
  }

  const { data: notifNumbers } = await supabase
    .from('crm_lead_notification_numbers')
    .select('phone')
    .eq('is_active', true);

  if (notifNumbers) {
    for (const n of notifNumbers) {
      const clean = n.phone.replace(/\D/g, '');
      if (clean && !numbersToNotify.includes(clean)) numbersToNotify.push(clean);
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
