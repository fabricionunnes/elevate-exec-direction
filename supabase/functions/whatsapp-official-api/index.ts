import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

Deno.serve(async (req) => {
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
        return await sendTemplateMessage(instance, params, supabase);

      case 'sendMedia':
        return await sendMediaMessage(instance, params);

      case 'getTemplates':
        return await getTemplates(instance);

      case 'createTemplate':
        return await createTemplate(instance, params, supabase);

      case 'deleteTemplate':
        return await deleteTemplate(instance, params);

      case 'verifyConnection':
        return await verifyConnection(instance);

      case 'getLimits':
        return await getLimits(instance);

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

async function sendTemplateMessage(instance: any, params: any, supabase: any) {
  const { phone, templateName, languageCode = 'pt_BR' } = params;
  let components: any[] = Array.isArray(params.components) ? params.components : [];
  // template com imagem no topo: a Meta exige o link da imagem em cada envio
  if (!components.some((c: any) => String(c?.type || '').toLowerCase() === 'header')) {
    const { data: tpl } = await supabase.from('whatsapp_template_status').select('header_image_url')
      .eq('waba_id', instance.waba_id).eq('template_name', templateName).eq('language', languageCode)
      .not('header_image_url', 'is', null).limit(1).maybeSingle();
    if (tpl?.header_image_url) components = [{ type: 'header', parameters: [{ type: 'image', image: { link: tpl.header_image_url } }] }, ...components];
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
    `${GRAPH_API_URL}/${instance.waba_id}/message_templates?fields=id,name,status,category,language,components,rejected_reason,quality_score&limit=100`,
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

// Limite diário de contatos (tier da Meta) + qualidade do número, pro card da tela Disparos API.
// A Meta conta contatos únicos iniciados pela empresa numa janela móvel de 24h.
async function getLimits(instance: any) {
  const fields = 'display_phone_number,verified_name,quality_rating,messaging_limit_tier,throughput,name_status,status,health_status';
  const response = await fetch(`https://graph.facebook.com/v21.0/${instance.phone_number_id}?fields=${fields}`, {
    headers: { 'Authorization': `Bearer ${instance.access_token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Erro ao consultar limites');
  const tiers: Record<string, number | null> = {
    TIER_50: 50, TIER_250: 250, TIER_1K: 1000, TIER_2K: 2000, TIER_10K: 10000, TIER_100K: 100000, TIER_UNLIMITED: null,
  };
  // 28/10/2026: a Meta parou de devolver messaging_limit_tier no número; o limite agora é da conta
  // (WABA, whatsapp_business_manager_messaging_limit). Sem isso o card mostrava "Ilimitado" com TIER_2K.
  let tier = data.messaging_limit_tier || null;
  if (!tier && instance.waba_id) {
    const w = await fetch(`https://graph.facebook.com/v21.0/${instance.waba_id}?fields=whatsapp_business_manager_messaging_limit`, {
      headers: { 'Authorization': `Bearer ${instance.access_token}` },
    }).then((r) => r.json()).catch(() => ({}));
    tier = w?.whatsapp_business_manager_messaging_limit || null;
  }
  const phoneEntity = (data.health_status?.entities || []).find((e: any) => e.entity_type === 'PHONE_NUMBER');
  return new Response(
    JSON.stringify({
      success: true,
      tier,
      dailyLimit: tier && tier in tiers ? tiers[tier] : null,
      qualityRating: data.quality_rating || null,
      nameStatus: data.name_status || null,
      canSendMessage: data.health_status?.can_send_message || null,
      info: phoneEntity?.additional_info || [],
      phoneNumber: data.display_phone_number || null,
      verifiedName: data.verified_name || null,
    }),
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

// Cria template e manda pra aprovação da Meta (status volta PENDING).
// params: { name, category: MARKETING|UTILITY, language='pt_BR', body, footer?, buttons?: string[] (quick reply), examples?: string[] }
// Imagem do topo do modelo: a Meta não aceita link na criação, só o código de um arquivo enviado
// pra ela (envio em duas etapas pelo aplicativo dono do token). Devolve esse código.
async function subirImagemExemplo(instance: any, url: string): Promise<string> {
  const img = await fetch(url);
  if (!img.ok) throw new Error('Não consegui abrir a imagem do template');
  const tipo = (img.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!/^image\/(jpeg|png)$/.test(tipo)) throw new Error('A imagem do template precisa ser JPG ou PNG');
  const bytes = new Uint8Array(await img.arrayBuffer());
  if (bytes.length > 5 * 1024 * 1024) throw new Error('A imagem do template passa de 5 MB');
  const auth = { 'Authorization': `Bearer ${instance.access_token}` };
  const app = await (await fetch(`${GRAPH_API_URL}/app`, { headers: auth })).json();
  if (!app?.id) throw new Error('A Meta não informou o aplicativo do token: ' + (app?.error?.message || 'sem detalhe'));
  const sessao = await (await fetch(`${GRAPH_API_URL}/${app.id}/uploads?file_length=${bytes.length}&file_type=${encodeURIComponent(tipo)}`, { method: 'POST', headers: auth })).json();
  if (!sessao?.id) throw new Error('A Meta recusou o envio da imagem: ' + (sessao?.error?.message || 'sem detalhe'));
  const envio = await (await fetch(`${GRAPH_API_URL}/${sessao.id}`, {
    method: 'POST', headers: { 'Authorization': `OAuth ${instance.access_token}`, 'file_offset': '0' }, body: bytes,
  })).json();
  if (!envio?.h) throw new Error('A Meta recusou a imagem: ' + (envio?.error?.message || 'sem detalhe'));
  return String(envio.h);
}

// params novos (23/11/2026): header_image_url (imagem no topo), link_button { text, url } (botão que abre um link)
async function createTemplate(instance: any, params: any, supabase: any) {
  const name = String(params.name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 512);
  const body = String(params.body || '').trim();
  if (!name || !body) throw new Error('Nome e texto do template são obrigatórios');
  const vars = new Set((body.match(/\{\{\d+\}\}/g) || []));
  const n = vars.size;
  for (let i = 1; i <= n; i++) if (!vars.has(`{{${i}}}`)) throw new Error(`Variáveis precisam ser sequenciais: falta {{${i}}}`);
  const examples: string[] = Array.isArray(params.examples) ? params.examples.map((e: any) => String(e)) : [];
  while (examples.length < n) examples.push(`Exemplo ${examples.length + 1}`);
  const imagemUrl = String(params.header_image_url || '').trim();
  const components: any[] = [];
  if (imagemUrl) {
    if (!/^https:\/\//i.test(imagemUrl)) throw new Error('O link da imagem precisa começar com https://');
    components.push({ type: 'HEADER', format: 'IMAGE', example: { header_handle: [await subirImagemExemplo(instance, imagemUrl)] } });
  }
  components.push({ type: 'BODY', text: body, ...(n ? { example: { body_text: [examples.slice(0, n)] } } : {}) });
  if (params.footer) components.push({ type: 'FOOTER', text: String(params.footer).slice(0, 60) });
  const buttons = (Array.isArray(params.buttons) ? params.buttons : []).map((b: any) => String(b).trim()).filter(Boolean).slice(0, 3);
  const linkTexto = String(params.link_button?.text || '').trim();
  const linkUrl = String(params.link_button?.url || '').trim();
  if ((linkTexto || linkUrl) && !(linkTexto && /^https:\/\//i.test(linkUrl))) throw new Error('Botão de link precisa do texto e de um link começando com https://');
  const todos: any[] = [
    ...(linkTexto ? [{ type: 'URL', text: linkTexto.slice(0, 25), url: linkUrl }] : []),
    ...buttons.map((t: string) => ({ type: 'QUICK_REPLY', text: t.slice(0, 25) })),
  ];
  if (todos.length) components.push({ type: 'BUTTONS', buttons: todos });

  const response = await fetch(`${GRAPH_API_URL}/${instance.waba_id}/message_templates`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${instance.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, language: params.language || 'pt_BR', category: params.category || 'MARKETING', components }),
  });
  const data = await response.json();
  console.log('[WhatsApp Official API] Create template response:', data);
  if (!response.ok) throw new Error(data.error?.error_user_msg || data.error?.message || 'Erro ao criar template');
  // o disparo precisa do link da imagem em cada envio: fica guardado junto do acompanhamento do template
  if (imagemUrl) {
    const { error: eImg } = await supabase.from('whatsapp_template_status').upsert({
      instance_id: instance.id, waba_id: instance.waba_id, template_name: name, template_id: data.id || null,
      language: params.language || 'pt_BR', category: data.category || params.category || 'MARKETING',
      status: data.status || 'PENDING', header_image_url: imagemUrl, atualizado_em: new Date().toISOString(),
    }, { onConflict: 'waba_id,template_name,language' });
    if (eImg) console.error('[WhatsApp Official API] guardar imagem do template:', eImg.message);
  }
  return new Response(JSON.stringify({ success: true, id: data.id, status: data.status, category: data.category, name }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function deleteTemplate(instance: any, params: any) {
  const name = String(params.name || '').trim();
  if (!name) throw new Error('Nome do template obrigatório');
  const response = await fetch(`${GRAPH_API_URL}/${instance.waba_id}/message_templates?name=${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${instance.access_token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.error_user_msg || data.error?.message || 'Erro ao excluir template');
  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
