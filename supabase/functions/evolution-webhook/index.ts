import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Evolution API v2.x sometimes uses different base paths.
const ROUTE_PREFIXES = ['', '/api/v1', '/api/v2', '/v1', '/v2'];

function normalizeBaseUrl(input: string) {
  return input.replace(/\/manager\/?$/i, '').replace(/\/+$/g, '');
}

// Some installs expect "apikey", others expect "Authorization: Bearer <key>".
function buildEvolutionHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey,
  };
}

// Helper to download media from Evolution API and upload to Supabase Storage
async function downloadAndStoreMedia(
  supabase: any,
  instanceName: string,
  messageId: string,
  mediaType: string,
  mimetype: string,
  evolutionBaseUrlOverride?: string | null,
  evolutionApiKeyOverride?: string | null,
): Promise<string | null> {
  try {
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    const apiBaseUrlRaw = (evolutionBaseUrlOverride || EVOLUTION_API_URL) ?? '';
    const apiKey = (evolutionApiKeyOverride || EVOLUTION_API_KEY) ?? '';

    if (!apiBaseUrlRaw || !apiKey) {
      console.error('Evolution API credentials not configured for media download');
      return null;
    }

    const baseUrl = normalizeBaseUrl(apiBaseUrlRaw);
    const headers = buildEvolutionHeaders(apiKey);

    const fetchWithPrefixes = async (path: string, init?: RequestInit) => {
      for (const prefix of ROUTE_PREFIXES) {
        const url = `${baseUrl}${prefix}${path}`;
        const response = await fetch(url, {
          ...init,
          headers: { ...headers, ...(init?.headers || {}) },
        });
        // Stop early on success OR on non-404/405 to surface auth errors quickly.
        if (response.ok || (response.status !== 404 && response.status !== 405)) {
          return response;
        }
      }
      // fallback
      return fetch(`${baseUrl}${ROUTE_PREFIXES[0]}${path}`, {
        ...init,
        headers: { ...headers, ...(init?.headers || {}) },
      });
    };

    // Call Evolution API to get base64 media
    const response = await fetchWithPrefixes(`/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
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
    let base64Data: string | null = data.base64 || null;

    // Some providers return "data:<mime>;base64,<...>".
    if (base64Data?.includes('base64,')) {
      base64Data = base64Data.split('base64,').pop() || null;
    }

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

Deno.serve(async (req) => {
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
    
    const event = body.event;
    const instanceName = body.instance;
    const data = body.data;

    // TEMPORARY: Log ALL incoming webhook payloads to debug missing group messages
    const remoteJid = data?.key?.remoteJid || data?.remoteJid || '';
    const isGroupEvent = remoteJid.includes('@g.us');
    const participant = data?.key?.participant || '';
    console.log(`[webhook] event=${event} instance=${instanceName} jid=${remoteJid} isGroup=${isGroupEvent} participant=${participant}`);
    
    // Log full payload for ALL messages.upsert events (to catch group messages)
    // and for any non-routine events
    if (event === 'messages.upsert' || isGroupEvent || !['messages.update', 'connection.update'].includes(event)) {
      console.log('[webhook] Full payload:', JSON.stringify(body, null, 2));
    }

    // Get instance from database (also fetch instance-specific API credentials)
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('id, status, api_url, api_key')
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
      // Handle alternative event names used by some Evolution API versions
      case 'message':
      case 'messages':
      case 'message.new':
        await handleIncomingMessage(
          supabase,
          instance.id,
          instanceName,
          data,
          instance.api_url ?? null,
          instance.api_key ?? null,
        );
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
        console.log('[webhook] Unhandled event:', event, '- payload keys:', Object.keys(body).join(','));
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

async function handleIncomingMessage(
  supabase: any,
  instanceId: string,
  instanceName: string,
  data: any,
  instanceApiUrl: string | null,
  instanceApiKey: string | null,
) {
  console.log('Processing incoming message:', JSON.stringify(data, null, 2));

  const message = data.message || data;
  const key = data.key || message.key;
  
  if (!key) {
    console.log('No message key found');
    return;
  }

  // Get the correct phone/group JID:
  // - remoteJid usually has the phone@s.whatsapp.net or groupId@g.us format
  // - remoteJidAlt may have @lid format (new WhatsApp format)
  // - Some newer versions use phone:N@s.whatsapp.net format (colon separator)
  let remoteJid = key.remoteJid || '';
  const remoteJidAlt = key.remoteJidAlt || '';
  const isGroup = remoteJid.includes('@g.us');
  
  console.log(`[webhook] JID analysis: remoteJid=${remoteJid}, remoteJidAlt=${remoteJidAlt}, isGroup=${isGroup}`);
  
  // If remoteJid is @lid format, try to use remoteJidAlt instead
  if (remoteJid.endsWith('@lid')) {
    if (remoteJidAlt.includes('@s.whatsapp.net') || remoteJidAlt.includes('@g.us')) {
      remoteJid = remoteJidAlt;
    } else {
      // For @lid without a valid alt, try to find phone from participant field (group messages)
      const participant = key.participant || '';
      if (participant.includes('@s.whatsapp.net')) {
        // This is a group message where remoteJid is LID but we have participant info
        // We can't determine the group, so skip
        console.log('Skipping @lid message without valid alt JID, participant:', participant);
        return;
      }
      console.log('Skipping message - @lid format without valid alternative:', remoteJid);
      return;
    }
  }
  
  // Clean up colon-separated JIDs (e.g., "553195575428:8@s.whatsapp.net" -> "553195575428@s.whatsapp.net")
  if (!isGroup && remoteJid.includes(':') && remoteJid.includes('@')) {
    const colonClean = remoteJid.replace(/:\d+@/, '@');
    console.log(`[webhook] Cleaned colon JID: ${remoteJid} -> ${colonClean}`);
    remoteJid = colonClean;
  }
  
  const fromMe = key.fromMe;
  const messageId = key.id;

  // Skip status messages
  if (remoteJid === 'status@broadcast') {
    console.log('Skipping status broadcast');
    return;
  }

  // Skip if we can't extract a valid identifier
  if (!remoteJid.includes('@')) {
    console.log('Skipping message - no @ in JID:', remoteJid);
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
  // IMPORTANT: Only use pushName when message is NOT from me (fromMe: false)
  // When fromMe is true, pushName is the device owner's name, not the contact's name
  const pushName = fromMe ? undefined : (data.pushName || message.pushName);
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
      mediaMimetype || 'application/octet-stream',
      // IMPORTANT: instance can override API URL/key (per-connection credentials)
      instanceApiUrl,
      instanceApiKey,
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

  // Fire-and-forget: check for cancellation intent on inbound text messages
  if (!fromMe && type === 'text' && content.length > 5) {
    detectCancellationIntent(supabase, content, phone).catch((err) =>
      console.error('[evolution-webhook] Cancellation detection error (non-blocking):', err)
    );
  }

  // Fire-and-forget: cancel pending CRM message queue items if lead replied
  if (!fromMe) {
    cancelPendingQueueOnReply(supabase, phone).catch((err) =>
      console.error('[evolution-webhook] Queue cancellation error (non-blocking):', err)
    );
  }
}

async function detectCancellationIntent(supabase: any, messageContent: string, phone: string) {
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
      console.log('[evolution-webhook] Cancellation detected!', result);
    }
  } catch (err) {
    console.error('[evolution-webhook] Error calling cancellation detection:', err);
  }
}

async function cancelPendingQueueOnReply(supabase: any, phone: string) {
  try {
    // Normalize phone to match queue format
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Find pending queue items for this phone where rule has stop_on_reply
    const { data: pendingItems } = await supabase
      .from('crm_notification_queue')
      .select('id, rule_id')
      .eq('phone', cleanPhone)
      .eq('status', 'pending');

    if (!pendingItems || pendingItems.length === 0) return;

    const ruleIds = [...new Set(pendingItems.map((p: any) => p.rule_id))];
    const { data: rules } = await supabase
      .from('crm_notification_rules')
      .select('id')
      .in('id', ruleIds)
      .eq('stop_on_reply', true);

    const stopRuleIds = new Set((rules || []).map((r: any) => r.id));
    const idsToCancel = pendingItems
      .filter((p: any) => stopRuleIds.has(p.rule_id))
      .map((p: any) => p.id);

    if (idsToCancel.length > 0) {
      await supabase
        .from('crm_notification_queue')
        .update({ status: 'cancelled', cancelled_reason: 'lead_replied' })
        .in('id', idsToCancel);

      console.log(`[evolution-webhook] Cancelled ${idsToCancel.length} queued messages for ${cleanPhone} (lead replied)`);
    }
  } catch (err) {
    console.error('[evolution-webhook] Error cancelling queue on reply:', err);
  }
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
  // Check if this is a group (18+ digit numbers are WhatsApp groups)
  const isGroup = phone.length >= 18;
  
  // Try to find existing contact
  const { data: existingContact } = await supabase
    .from('crm_whatsapp_contacts')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (existingContact) {
    // Only update name if:
    // 1. A new name is provided (pushName)
    // 2. It's NOT a group (groups should not be renamed by pushName)
    // 3. The current name is still the default (same as phone number)
    // This preserves any manual renames done in the system
    const shouldUpdateName = name && 
                             !isGroup && 
                             existingContact.name === existingContact.phone;
    
    if (shouldUpdateName) {
      console.log(`Updating contact name from "${existingContact.name}" to "${name}"`);
      await supabase
        .from('crm_whatsapp_contacts')
        .update({ name: name })
        .eq('id', existingContact.id);
      existingContact.name = name;
    }
    return existingContact;
  }

  // Create new contact
  // For groups, use the phone as name (no pushName rename)
  // For individual contacts, use pushName if available
  const contactName = isGroup ? phone : (name || phone);
  
  const { data: newContact, error } = await supabase
    .from('crm_whatsapp_contacts')
    .insert({
      phone: phone,
      name: contactName,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating contact:', error);
    throw error;
  }

  console.log(`Created new contact: ${phone}, name: ${contactName}, isGroup: ${isGroup}`);
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
    .maybeSingle();

  if (existingConversation) {
    return existingConversation;
  }

  const { data: inheritedConversation } = await supabase
    .from('crm_whatsapp_conversations')
    .select('lead_id')
    .eq('contact_id', contactId)
    .not('lead_id', 'is', null)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Create new conversation
  const { data: newConversation, error } = await supabase
    .from('crm_whatsapp_conversations')
    .insert({
      instance_id: instanceId,
      contact_id: contactId,
      lead_id: inheritedConversation?.lead_id || null,
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