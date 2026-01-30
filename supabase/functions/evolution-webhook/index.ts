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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('Evolution webhook received:', JSON.stringify(body, null, 2));

    const event = body.event;
    const instanceName = body.instance;
    const data = body.data;

    // Get instance from database
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('id, status')
      .eq('instance_name', instanceName)
      .single();

    if (!instance) {
      console.log('Instance not found:', instanceName);
      return new Response(JSON.stringify({ success: false, error: 'Instance not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    switch (event) {
      case 'messages.upsert':
        await handleIncomingMessage(supabase, instance.id, data);
        break;
      
      case 'messages.update':
        await handleMessageStatusUpdate(supabase, data);
        break;
      
      case 'connection.update':
        await handleConnectionUpdate(supabase, instance.id, instanceName, data);
        break;
      
      case 'qrcode.updated':
        await handleQRCodeUpdate(supabase, instance.id, data);
        break;

      default:
        console.log('Unhandled event:', event);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function handleIncomingMessage(supabase: any, instanceId: string, data: any) {
  console.log('Processing incoming message:', JSON.stringify(data, null, 2));

  const message = data.message || data;
  const key = data.key || message.key;
  
  if (!key) {
    console.log('No message key found');
    return;
  }

  const remoteJid = key.remoteJid;
  const fromMe = key.fromMe;
  const messageId = key.id;

  // Skip status messages
  if (remoteJid === 'status@broadcast') {
    return;
  }

  // Extract phone number
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  
  // Get or create contact
  let contact = await getOrCreateContact(supabase, phone, message.pushName);
  
  // Get or create conversation
  let conversation = await getOrCreateConversation(supabase, instanceId, contact.id);
  
  // Determine message content and type
  let content = '';
  let type = 'text';
  let mediaUrl = null;
  let mediaMimetype = null;

  const msg = message.message;
  
  if (msg) {
    // Text messages - check all possible text fields
    if (msg.conversation) {
      content = msg.conversation;
    } else if (msg.extendedTextMessage?.text) {
      content = msg.extendedTextMessage.text;
    } else if (msg.buttonsResponseMessage?.selectedButtonId) {
      content = msg.buttonsResponseMessage.selectedDisplayText || msg.buttonsResponseMessage.selectedButtonId;
    } else if (msg.listResponseMessage?.title) {
      content = msg.listResponseMessage.title;
    } else if (msg.templateButtonReplyMessage?.selectedDisplayText) {
      content = msg.templateButtonReplyMessage.selectedDisplayText;
    } else if (msg.imageMessage) {
      type = 'image';
      content = msg.imageMessage.caption || '[Imagem]';
      mediaMimetype = msg.imageMessage.mimetype;
    } else if (msg.audioMessage) {
      type = 'audio';
      content = '[Áudio]';
      mediaMimetype = msg.audioMessage.mimetype;
    } else if (msg.videoMessage) {
      type = 'video';
      content = msg.videoMessage.caption || '[Vídeo]';
      mediaMimetype = msg.videoMessage.mimetype;
    } else if (msg.documentMessage) {
      type = 'document';
      content = msg.documentMessage.fileName || '[Documento]';
      mediaMimetype = msg.documentMessage.mimetype;
    } else if (msg.stickerMessage) {
      type = 'sticker';
      content = '[Sticker]';
    } else if (msg.contactMessage) {
      type = 'contact';
      content = msg.contactMessage.displayName || '[Contato]';
    } else if (msg.locationMessage) {
      type = 'location';
      content = '[Localização]';
    } else if (msg.reactionMessage) {
      // Skip reaction messages - they don't have content to display
      console.log('Skipping reaction message');
      return;
    } else if (msg.protocolMessage || msg.senderKeyDistributionMessage) {
      // Skip protocol/system messages - they're not user content
      console.log('Skipping protocol/system message');
      return;
    }
  }

  // If we still have no content, skip this message
  if (!content && type === 'text') {
    console.log('Skipping message with no content:', JSON.stringify(msg, null, 2).substring(0, 500));
    return;
  }

  // Insert message
  const { error: msgError } = await supabase
    .from('crm_whatsapp_messages')
    .insert({
      conversation_id: conversation.id,
      remote_id: messageId,
      content: content,
      type: type,
      direction: fromMe ? 'outbound' : 'inbound',
      status: 'delivered',
      media_url: mediaUrl,
      media_mimetype: mediaMimetype,
    });

  if (msgError) {
    console.error('Error inserting message:', msgError);
    return;
  }

  // Update conversation
  const updateData: any = {
    last_message: content,
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!fromMe) {
    updateData.unread_count = (conversation.unread_count || 0) + 1;
    if (conversation.status === 'closed') {
      updateData.status = 'open';
    }
  }

  await supabase
    .from('crm_whatsapp_conversations')
    .update(updateData)
    .eq('id', conversation.id);

  console.log('Message processed successfully');
}

async function handleMessageStatusUpdate(supabase: any, data: any) {
  console.log('Processing message status update:', JSON.stringify(data, null, 2));

  const key = data.key;
  const status = data.status;

  if (!key || !status) return;

  // Map Evolution API status to our status
  const statusMap: Record<number, string> = {
    0: 'pending',
    1: 'sent',
    2: 'delivered',
    3: 'read',
    4: 'read',
  };

  const mappedStatus = statusMap[status] || 'sent';

  await supabase
    .from('crm_whatsapp_messages')
    .update({ status: mappedStatus })
    .eq('remote_id', key.id);
}

async function handleConnectionUpdate(supabase: any, instanceId: string, instanceName: string, data: any) {
  console.log('Processing connection update:', JSON.stringify(data, null, 2));

  const state = data.state;
  
  let status = 'disconnected';
  if (state === 'open') {
    status = 'connected';
  } else if (state === 'connecting') {
    status = 'connecting';
  }

  await supabase
    .from('whatsapp_instances')
    .update({ 
      status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', instanceId);

  console.log(`Instance ${instanceName} status updated to: ${status}`);
}

async function handleQRCodeUpdate(supabase: any, instanceId: string, data: any) {
  console.log('Processing QR code update');

  const qrCode = data.qrcode?.base64 || data.base64 || data.qr;

  if (qrCode) {
    await supabase
      .from('whatsapp_instances')
      .update({ 
        qr_code: qrCode,
        status: 'connecting',
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId);
  }
}

async function getOrCreateContact(supabase: any, phone: string, name?: string) {
  // Try to find existing contact
  const { data: existingContact } = await supabase
    .from('crm_whatsapp_contacts')
    .select('*')
    .eq('phone', phone)
    .single();

  if (existingContact) {
    // Update name if provided and different
    if (name && name !== existingContact.name) {
      await supabase
        .from('crm_whatsapp_contacts')
        .update({ name: name })
        .eq('id', existingContact.id);
    }
    return existingContact;
  }

  // Create new contact
  const { data: newContact, error } = await supabase
    .from('crm_whatsapp_contacts')
    .insert({
      phone: phone,
      name: name || phone,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating contact:', error);
    throw error;
  }

  return newContact;
}

async function getOrCreateConversation(supabase: any, instanceId: string, contactId: string) {
  // Try to find existing open conversation
  const { data: existingConversation } = await supabase
    .from('crm_whatsapp_conversations')
    .select('*')
    .eq('instance_id', instanceId)
    .eq('contact_id', contactId)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existingConversation) {
    return existingConversation;
  }

  // Create new conversation
  const { data: newConversation, error } = await supabase
    .from('crm_whatsapp_conversations')
    .insert({
      instance_id: instanceId,
      contact_id: contactId,
      status: 'open',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }

  return newConversation;
}