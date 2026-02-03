import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, instanceId, ...params } = await req.json();
    console.log('[WhatsApp Official API] Action:', action, 'Instance:', instanceId);

    // Get instance details
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_official_instances')
      .select('*')
      .eq('id', instanceId)
      .single();

    if (instanceError || !instance) {
      throw new Error('Instância não encontrada');
    }

    switch (action) {
      case 'sendText':
        return await sendTextMessage(instance, params);

      case 'sendTemplate':
        return await sendTemplateMessage(instance, params);

      case 'sendMedia':
        return await sendMediaMessage(instance, params);

      case 'getTemplates':
        return await getTemplates(instance);

      case 'verifyConnection':
        return await verifyConnection(instance);

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  } catch (error: unknown) {
    console.error('[WhatsApp Official API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendTextMessage(instance: any, params: any) {
  const { phone, message } = params;

  const response = await fetch(
    `${GRAPH_API_URL}/${instance.phone_number_id}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${instance.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: { body: message },
      }),
    }
  );

  const data = await response.json();
  console.log('[WhatsApp Official API] Send text response:', data);

  if (!response.ok) {
    throw new Error(data.error?.message || 'Erro ao enviar mensagem');
  }

  return new Response(
    JSON.stringify({ success: true, messageId: data.messages?.[0]?.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function sendTemplateMessage(instance: any, params: any) {
  const { phone, templateName, languageCode = 'pt_BR', components = [] } = params;

  const response = await fetch(
    `${GRAPH_API_URL}/${instance.phone_number_id}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${instance.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    }
  );

  const data = await response.json();
  console.log('[WhatsApp Official API] Send template response:', data);

  if (!response.ok) {
    throw new Error(data.error?.message || 'Erro ao enviar template');
  }

  return new Response(
    JSON.stringify({ success: true, messageId: data.messages?.[0]?.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function sendMediaMessage(instance: any, params: any) {
  const { phone, mediaType, mediaUrl, caption } = params;

  const mediaObject: any = {
    link: mediaUrl,
  };

  if (caption && ['image', 'video', 'document'].includes(mediaType)) {
    mediaObject.caption = caption;
  }

  const response = await fetch(
    `${GRAPH_API_URL}/${instance.phone_number_id}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${instance.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: mediaType,
        [mediaType]: mediaObject,
      }),
    }
  );

  const data = await response.json();
  console.log('[WhatsApp Official API] Send media response:', data);

  if (!response.ok) {
    throw new Error(data.error?.message || 'Erro ao enviar mídia');
  }

  return new Response(
    JSON.stringify({ success: true, messageId: data.messages?.[0]?.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getTemplates(instance: any) {
  const response = await fetch(
    `${GRAPH_API_URL}/${instance.waba_id}/message_templates`,
    {
      headers: {
        'Authorization': `Bearer ${instance.access_token}`,
      },
    }
  );

  const data = await response.json();
  console.log('[WhatsApp Official API] Get templates response:', data);

  if (!response.ok) {
    throw new Error(data.error?.message || 'Erro ao buscar templates');
  }

  return new Response(
    JSON.stringify({ templates: data.data || [] }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function verifyConnection(instance: any) {
  // Verify by getting phone number info
  const response = await fetch(
    `${GRAPH_API_URL}/${instance.phone_number_id}`,
    {
      headers: {
        'Authorization': `Bearer ${instance.access_token}`,
      },
    }
  );

  const data = await response.json();
  console.log('[WhatsApp Official API] Verify connection response:', data);

  if (!response.ok) {
    throw new Error(data.error?.message || 'Erro ao verificar conexão');
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      phoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
      qualityRating: data.quality_rating,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
