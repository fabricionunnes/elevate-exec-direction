import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const url = new URL(req.url);

  // GET request = webhook verification from Meta
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('[WhatsApp Official Webhook] Verification request:', { mode, token });

    if (mode === 'subscribe' && token) {
      // Verify the token matches one of our instances
      const { data: instance } = await supabase
        .from('whatsapp_official_instances')
        .select('id')
        .eq('webhook_verify_token', token)
        .single();

      if (instance) {
        console.log('[WhatsApp Official Webhook] Token verified for instance:', instance.id);
        
        // Update instance status to connected
        await supabase
          .from('whatsapp_official_instances')
          .update({ status: 'connected' })
          .eq('id', instance.id);

        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }

    console.log('[WhatsApp Official Webhook] Verification failed');
    return new Response('Forbidden', { status: 403 });
  }

  // POST request = incoming webhook from Meta
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('[WhatsApp Official Webhook] Received:', JSON.stringify(body, null, 2));

      const entry = body.entry?.[0];
      if (!entry) {
        return new Response(JSON.stringify({ status: 'no entry' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const changes = entry.changes?.[0];
      if (!changes || changes.field !== 'messages') {
        return new Response(JSON.stringify({ status: 'not messages' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const value = changes.value;
      const phoneNumberId = value.metadata?.phone_number_id;

      // Find the instance by phone_number_id
      const { data: instance } = await supabase
        .from('whatsapp_official_instances')
        .select('id')
        .eq('phone_number_id', phoneNumberId)
        .single();

      if (!instance) {
        console.log('[WhatsApp Official Webhook] Instance not found for phone_number_id:', phoneNumberId);
        return new Response(JSON.stringify({ status: 'instance not found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Process incoming messages
      const messages = value.messages || [];
      for (const message of messages) {
        await processIncomingMessage(supabase, instance.id, message, value.contacts?.[0]);
      }

      // Process status updates
      const statuses = value.statuses || [];
      for (const status of statuses) {
        await processStatusUpdate(supabase, status);
      }

      return new Response(JSON.stringify({ status: 'processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error: unknown) {
      console.error('[WhatsApp Official Webhook] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 200, // Always return 200 to Meta to prevent retries
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});

async function processIncomingMessage(
  supabase: any,
  officialInstanceId: string,
  message: any,
  contact: any
) {
  const phone = message.from;
  const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();

  console.log('[WhatsApp Official] Processing message from:', phone);

  // Find or create contact
  const { data: existingContact } = await supabase
    .from('crm_whatsapp_contacts')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  let contactId: string;
  if (existingContact) {
    contactId = existingContact.id;
    // Update contact name if available
    if (contact?.profile?.name) {
      await supabase
        .from('crm_whatsapp_contacts')
        .update({ name: contact.profile.name })
        .eq('id', contactId);
    }
  } else {
    const { data: newContact, error } = await supabase
      .from('crm_whatsapp_contacts')
      .insert({
        phone,
        name: contact?.profile?.name || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[WhatsApp Official] Error creating contact:', error);
      return;
    }
    contactId = newContact.id;
  }

  // Find or create conversation
  const { data: existingConv } = await supabase
    .from('crm_whatsapp_conversations')
    .select('id, unread_count')
    .eq('contact_id', contactId)
    .eq('official_instance_id', officialInstanceId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId: string;
  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const { data: inheritedConversation } = await supabase
      .from('crm_whatsapp_conversations')
      .select('lead_id')
      .eq('contact_id', contactId)
      .not('lead_id', 'is', null)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: newConv, error } = await supabase
      .from('crm_whatsapp_conversations')
      .insert({
        contact_id: contactId,
        official_instance_id: officialInstanceId,
        lead_id: inheritedConversation?.lead_id || null,
        status: 'open',
        unread_count: 0,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[WhatsApp Official] Error creating conversation:', error);
      return;
    }
    conversationId = newConv.id;
  }

  // Extract message content
  let content = '';
  let type = 'text';
  let mediaUrl: string | null = null;
  let mediaMimetype: string | null = null;
  // id da mídia na Meta: o arquivo não vem no webhook, precisa baixar pela Graph
  const mediaObj = message.image || message.video || message.audio || message.document || message.sticker || null;
  const mediaId: string | null = mediaObj?.id || null;

  switch (message.type) {
    case 'text':
      content = message.text?.body || '';
      break;
    case 'image':
      type = 'image';
      content = message.image?.caption || '[Imagem]';
      break;
    case 'video':
      type = 'video';
      content = message.video?.caption || '[Vídeo]';
      break;
    case 'audio':
      type = 'audio';
      content = '[Áudio]';
      break;
    case 'document':
      type = 'document';
      content = message.document?.filename || '[Documento]';
      break;
    case 'sticker':
      type = 'sticker';
      content = '[Sticker]';
      break;
    case 'reaction':
      // emoji vazio = a pessoa removeu a reação
      type = 'reaction';
      content = message.reaction?.emoji || '';
      break;
    case 'location':
      type = 'location';
      content = `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`;
      break;
    case 'contacts':
      type = 'contact';
      content = '[Contato]';
      break;
    case 'button':
      content = message.button?.text || '[Botão]';
      break;
    case 'interactive':
      content = message.interactive?.button_reply?.title || 
                message.interactive?.list_reply?.title || 
                '[Interativo]';
      break;
    default:
      content = `[${message.type}]`;
  }

  // Reação: aponta pra mensagem reagida (o Atendimento mostra o emoji embaixo dela)
  let quotedMessageId: string | null = null;
  if (type === 'reaction') {
    const alvoWamid = message.reaction?.message_id;
    if (alvoWamid) {
      const { data: alvo } = await supabase
        .from('crm_whatsapp_messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .or(`whatsapp_message_id.eq.${alvoWamid},remote_id.eq.${alvoWamid}`)
        .limit(1)
        .maybeSingle();
      quotedMessageId = alvo?.id || null;
    }
    if (quotedMessageId) {
      await supabase
        .from('crm_whatsapp_messages')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('type', 'reaction')
        .eq('direction', 'inbound')
        .eq('quoted_message_id', quotedMessageId);
    }
    if (!content) return;
  }

  // Baixa a mídia na hora (o link da Meta expira) e guarda no bucket público,
  // igual o Evolution faz. Sem isso vídeo/imagem/áudio ficavam sem media_url e
  // não abriam no Atendimento nem chegavam na IA (14/09/2026).
  if (mediaId) {
    const stored = await storeOfficialMedia(supabase, instanceId, mediaId, type, message.id);
    if (stored) { mediaUrl = stored.url; mediaMimetype = stored.mime; }
  }

  // Insert message
  const { error: msgError } = await supabase
    .from('crm_whatsapp_messages')
    .insert({
      conversation_id: conversationId,
      content,
      type,
      direction: 'inbound',
      status: 'received',
      whatsapp_message_id: message.id,
      media_url: mediaUrl,
      media_mimetype: mediaMimetype,
      quoted_message_id: quotedMessageId,
      created_at: timestamp,
    });

  if (msgError) {
    console.error('[WhatsApp Official] Error inserting message:', msgError);
    return;
  }

  // Update conversation
  const currentUnread = existingConv?.unread_count || 0;
  await supabase
    .from('crm_whatsapp_conversations')
    .update({
      last_message: (type === 'reaction' ? `Reagiu com ${content}` : content).substring(0, 255),
      last_message_at: timestamp,
      unread_count: type === 'reaction' ? currentUnread : currentUnread + 1,
      status: 'open',
    })
    .eq('id', conversationId);

  console.log('[WhatsApp Official] Message processed successfully');

  // Fire-and-forget: check for cancellation intent on inbound text messages
  // filtro barato antes da IA: só analisa mensagens com termo de cancelamento
  const temTermoCancel = /cancel|rescind|encerr|renovar|renova[cç]|desist|não quero mais|nao quero mais|suspender|parar o serv|sair do contrato|distrato/i.test(content);
  if (type === 'text' && content.length > 5 && temTermoCancel) {
    detectCancellationIntent(content, phone).catch((err) =>
      console.error('[WhatsApp Official] Cancellation detection error (non-blocking):', err)
    );
  }
}

async function detectCancellationIntent(messageContent: string, phone: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const response = await fetch(`${supabaseUrl}/functions/v1/detect-cancellation-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ messageContent, phone }),
    });

    const result = await response.json();
    if (result.detected) {
      console.log('[WhatsApp Official] Cancellation detected!', result);
    }
  } catch (err) {
    console.error('[WhatsApp Official] Error calling cancellation detection:', err);
  }
}

async function processStatusUpdate(supabase: any, status: any) {
  const messageId = status.id;
  const statusValue = status.status; // sent, delivered, read, failed

  console.log('[WhatsApp Official] Status update:', messageId, statusValue);

  let dbStatus = statusValue;
  if (statusValue === 'delivered') dbStatus = 'delivered';
  if (statusValue === 'read') dbStatus = 'read';
  if (statusValue === 'failed') dbStatus = 'failed';

  // Falha: guarda o motivo da Meta (ex.: 141006 = sem método de pagamento na WABA,
  // 131049 = limite de marketing pro usuário) — antes o "failed" ficava mudo (13/09/2026).
  const patch: Record<string, unknown> = { status: dbStatus };
  if (statusValue === 'failed') {
    const errs = Array.isArray(status.errors) ? status.errors : [];
    const txt = errs.map((e: any) => `${e.code || ''} ${e.title || e.message || ''}${e.error_data?.details ? ' — ' + e.error_data.details : ''}`.trim()).filter(Boolean).join(' | ');
    patch.error_text = (txt || 'falha sem detalhe da Meta').slice(0, 500);
    console.error('[WhatsApp Official] Falha de entrega:', messageId, patch.error_text);
  }
  // Status chega fora de ordem (read antes de delivered): nunca rebaixa a mensagem.
  let q = supabase.from('crm_whatsapp_messages').update(patch).eq('whatsapp_message_id', messageId);
  if (statusValue === 'sent') q = q.in('status', ['pending', 'sent']);
  else if (statusValue === 'delivered') q = q.in('status', ['pending', 'sent', 'delivered']);
  else if (statusValue === 'read') q = q.neq('status', 'failed');
  await q;

  await atualizarDestinatarioDisparo(supabase, messageId, statusValue, status, patch.error_text as string | undefined);
}

// Histórico de disparos (tela Disparos API): status, cobrança e motivo da falha
// por lead. Falhou a entrega → o lead volta pra etapa de onde o disparo tirou.
async function atualizarDestinatarioDisparo(supabase: any, messageId: string, statusValue: string, status: any, errorText?: string) {
  try {
    const { data: recs } = await supabase
      .from('whatsapp_official_campaign_recipients')
      .select('id, status, lead_id, moved_from_stage_id, moved_to_stage_id, stage_reverted')
      .eq('whatsapp_message_id', messageId);
    if (!recs?.length) return;
    const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3 };
    const now = new Date().toISOString();
    for (const r of recs) {
      const upd: Record<string, unknown> = {};
      if (status.pricing) {
        if (typeof status.pricing.billable === 'boolean') upd.billable = status.pricing.billable;
        if (status.pricing.category) upd.pricing_category = String(status.pricing.category).toUpperCase();
      }
      if (statusValue === 'failed') {
        upd.status = 'failed';
        upd.error_text = errorText || 'falha sem detalhe da Meta';
        upd.failed_at = now;
        if (r.lead_id && r.moved_from_stage_id && r.moved_to_stage_id && !r.stage_reverted) {
          const { data: from } = await supabase.from('crm_stages').select('pipeline_id').eq('id', r.moved_from_stage_id).maybeSingle();
          const back: Record<string, unknown> = { stage_id: r.moved_from_stage_id };
          if (from?.pipeline_id) back.pipeline_id = from.pipeline_id;
          const { data: moved } = await supabase.from('crm_leads').update(back)
            .eq('id', r.lead_id).eq('stage_id', r.moved_to_stage_id).select('id');
          if (moved?.length) upd.stage_reverted = true;
        }
      } else if (r.status !== 'failed' && (rank[statusValue] ?? 0) > (rank[r.status] ?? 0)) {
        upd.status = statusValue;
        if (statusValue === 'delivered') upd.delivered_at = now;
        if (statusValue === 'read') upd.read_at = now;
      }
      if (Object.keys(upd).length) {
        await supabase.from('whatsapp_official_campaign_recipients').update(upd).eq('id', r.id);
      }
    }
  } catch (e) {
    console.error('[WhatsApp Official] atualizarDestinatarioDisparo:', e);
  }
}

async function storeOfficialMedia(
  supabase: any,
  instanceId: string,
  mediaId: string,
  type: string,
  wamid: string,
): Promise<{ url: string; mime: string } | null> {
  try {
    const { data: inst } = await supabase
      .from('whatsapp_official_instances')
      .select('access_token')
      .eq('id', instanceId)
      .maybeSingle();
    const token = inst?.access_token;
    if (!token) return null;
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      console.error('[WhatsApp Official] media meta error:', metaRes.status, (await metaRes.text()).slice(0, 200));
      return null;
    }
    const meta = await metaRes.json();
    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!fileRes.ok) {
      console.error('[WhatsApp Official] media download error:', fileRes.status);
      return null;
    }
    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    const mime = String(meta.mime_type || fileRes.headers.get('content-type') || 'application/octet-stream');
    const base = mime.split(';')[0].trim();
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
      'video/mp4': 'mp4', 'video/3gpp': '3gp',
      'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/amr': 'amr', 'audio/aac': 'aac',
      'application/pdf': 'pdf',
    };
    const ext = extMap[base] || base.split('/')[1] || 'bin';
    const safeId = String(wamid || mediaId).replace(/[^A-Za-z0-9_-]/g, '');
    const path = `whatsapp/official/${type}/${safeId}.${ext}`;
    let { error } = await supabase.storage.from('whatsapp-media').upload(path, bytes, { contentType: mime, upsert: true });
    if (error) {
      // bucket só aceita alguns tipos; o resto vai como binário genérico
      ({ error } = await supabase.storage.from('whatsapp-media').upload(path, bytes, { contentType: 'application/octet-stream', upsert: true }));
    }
    if (error) {
      console.error('[WhatsApp Official] media upload error:', error);
      return null;
    }
    const { data } = supabase.storage.from('whatsapp-media').getPublicUrl(path);
    return { url: data.publicUrl, mime };
  } catch (e) {
    console.error('[WhatsApp Official] storeOfficialMedia error:', e);
    return null;
  }
}
