import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
    const { data: newConv, error } = await supabase
      .from('crm_whatsapp_conversations')
      .insert({
        contact_id: contactId,
        official_instance_id: officialInstanceId,
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
  let mediaUrl = null;

  switch (message.type) {
    case 'text':
      content = message.text?.body || '';
      break;
    case 'image':
      type = 'image';
      content = message.image?.caption || '[Imagem]';
      // Media URL would need to be fetched from Meta API
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
      last_message: content.substring(0, 255),
      last_message_at: timestamp,
      unread_count: currentUnread + 1,
      status: 'open',
    })
    .eq('id', conversationId);

  console.log('[WhatsApp Official] Message processed successfully');
}

async function processStatusUpdate(supabase: any, status: any) {
  const messageId = status.id;
  const statusValue = status.status; // sent, delivered, read, failed

  console.log('[WhatsApp Official] Status update:', messageId, statusValue);

  let dbStatus = statusValue;
  if (statusValue === 'delivered') dbStatus = 'delivered';
  if (statusValue === 'read') dbStatus = 'read';
  if (statusValue === 'failed') dbStatus = 'failed';

  await supabase
    .from('crm_whatsapp_messages')
    .update({ status: dbStatus })
    .eq('whatsapp_message_id', messageId);
}
