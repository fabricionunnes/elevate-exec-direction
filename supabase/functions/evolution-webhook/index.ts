import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to download media from Evolution API and upload to Supabase Storage
async function downloadAndStoreMedia(
  supabase: any,
  instanceName: string,
  messageId: string,
  mediaType: string,
  mimetype: string
): Promise<string | null> {
  try {
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error('Evolution API credentials not configured for media download');
      return null;
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/manager\/?$/i, '').replace(/\/+$/g, '');

    // Call Evolution API to get base64 media
    const response = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        message: { key: { id: messageId } },
        convertToMp4: mediaType === 'audio', // Convert audio to mp4 for better compatibility
      }),
    });

    if (!response.ok) {
      console.error('Failed to get base64 from Evolution:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const base64Data = data.base64;

    if (!base64Data) {
      console.error('No base64 data returned from Evolution API');
      return null;
    }

    // Determine file extension
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'audio/ogg; codecs=opus': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'application/pdf': 'pdf',
    };
    const ext = extMap[mimetype] || mimetype.split('/')[1] || 'bin';
    const fileName = `${messageId}.${ext}`;
    const storagePath = `whatsapp/${mediaType}/${fileName}`;

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, bytes, {
        contentType: mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading to storage:', uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath);

    console.log('Media stored successfully:', urlData.publicUrl);
    return urlData.publicUrl;

  } catch (error) {
    console.error('Error downloading/storing media:', error);
    return null;
  }
}

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
        await handleIncomingMessage(supabase, instance.id, instanceName, data);
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

async function handleIncomingMessage(supabase: any, instanceId: string, instanceName: string, data: any) {
  console.log('Processing incoming message:', JSON.stringify(data, null, 2));

  const message = data.message || data;
  const key = data.key || message.key;
  
  if (!key) {
    console.log('No message key found');
    return;
  }

  // Get the correct phone number:
  // - remoteJid usually has the phone@s.whatsapp.net format
  // - remoteJidAlt may have @lid format (new WhatsApp format)
  // We need to use remoteJid if it contains the phone number
  let remoteJid = key.remoteJid || '';
  const remoteJidAlt = key.remoteJidAlt || '';
  
  // If remoteJid is @lid format, try to use remoteJidAlt instead
  if (remoteJid.endsWith('@lid') && remoteJidAlt.includes('@s.whatsapp.net')) {
    remoteJid = remoteJidAlt;
  }
  // If remoteJidAlt is @lid and remoteJid is valid phone, use remoteJid
  // (This is already the case since remoteJid is used by default)
  
  const fromMe = key.fromMe;
  const messageId = key.id;

  // Skip status messages
  if (remoteJid === 'status@broadcast') {
    console.log('Skipping status broadcast');
    return;
  }

  // Skip if we can't extract a valid phone number
  if (remoteJid.endsWith('@lid') || !remoteJid.includes('@')) {
    console.log('Skipping message - cannot extract phone from JID:', remoteJid);
    return;
  }

  // Extract phone number from JID
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  
  if (!phone || phone.length < 8) {
    console.log('Invalid phone number extracted:', phone);
    return;
  }

  console.log('Extracted phone:', phone, 'fromMe:', fromMe);
  
  // Get or create contact - use pushName from data level
  const pushName = data.pushName || message.pushName;
  let contact = await getOrCreateContact(supabase, phone, pushName);
  
  // Get or create conversation
  let conversation = await getOrCreateConversation(supabase, instanceId, contact.id);
  
  // Determine message content and type
  let content = '';
  let type = 'text';
  let mediaUrl = null;
  let mediaMimetype = null;

  // Evolution payload formats vary. Common cases:
  // 1) data.message.message => { conversation | extendedTextMessage | imageMessage | ... }
  // 2) data.message => { conversation | imageMessage | audioMessage | ... } (no nested .message)
  // 3) data => { message: { ... }, key: { ... } }
  const msgContainer = data?.data?.message || data?.message || message;
  const msg = msgContainer?.message ?? msgContainer;
  
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
      mediaUrl = msg.imageMessage.url;
    } else if (msg.audioMessage) {
      type = 'audio';
      content = '[Áudio]';
      mediaMimetype = msg.audioMessage.mimetype;
      mediaUrl = msg.audioMessage.url;
    } else if (msg.videoMessage) {
      type = 'video';
      content = msg.videoMessage.caption || '[Vídeo]';
      mediaMimetype = msg.videoMessage.mimetype;
      mediaUrl = msg.videoMessage.url;
    } else if (msg.documentMessage) {
      type = 'document';
      content = msg.documentMessage.fileName || '[Documento]';
      mediaMimetype = msg.documentMessage.mimetype;
      mediaUrl = msg.documentMessage.url;
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
    } else if (msg.templateMessage) {
      // Handle template messages (WhatsApp Business)
      type = 'template';
      const template = msg.templateMessage?.interactiveMessageTemplate || msg.templateMessage?.hydratedFourRowTemplate;
      content = template?.body?.text || '[Mensagem de Template]';
    }
  }

  // If we still have no content, skip safely (no substring on undefined)
  if (!content && type === 'text') {
    const messageType = data.messageType || message.messageType;
    console.log('Skipping message with no content. MessageType:', messageType);
    return;
  }

  // Check for duplicate message
  const { data: existingMessage } = await supabase
    .from('crm_whatsapp_messages')
    .select('id')
    .eq('remote_id', messageId)
    .maybeSingle();

  if (existingMessage) {
    console.log('Message already exists, skipping:', messageId);
    return;
  }

  // If this is a media message, download and store in Supabase Storage
  let storedMediaUrl = mediaUrl;
  if (mediaUrl && ['image', 'video', 'audio', 'document'].includes(type)) {
    console.log(`Downloading ${type} media for message ${messageId}...`);
    const downloadedUrl = await downloadAndStoreMedia(
      supabase,
      instanceName,
      messageId,
      type,
      mediaMimetype || 'application/octet-stream'
    );
    if (downloadedUrl) {
      storedMediaUrl = downloadedUrl;
      console.log(`Media stored at: ${storedMediaUrl}`);
    } else {
      console.log('Failed to download media, keeping original URL (may expire)');
    }
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
      media_url: storedMediaUrl,
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

  console.log('Message processed successfully:', { phone, content: content.substring(0, 50), type, fromMe });
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