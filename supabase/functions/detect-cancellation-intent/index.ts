import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALERT_NUMBERS = ['5531989840003', '5531997667686'];
const ALERT_INSTANCE_NAME = 'UNV Financeiro';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { messageContent, phone } = await req.json();

    if (!messageContent || !phone) {
      return new Response(JSON.stringify({ detected: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Cancellation Detection] Analyzing message from:', phone);

    // Step 1: Use AI to detect cancellation intent
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[Cancellation Detection] LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ detected: false, error: 'AI not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Você é um analisador de intenção de cancelamento. Analise a mensagem do cliente e determine se ele está solicitando, pedindo ou mencionando cancelamento de contrato, encerramento de serviço, desistência, ou rescisão. 
Responda APENAS com um JSON: {"is_cancellation": true/false, "confidence": 0.0-1.0}
Exemplos de cancelamento: "quero cancelar", "vou encerrar o contrato", "não quero mais o serviço", "gostaria de cancelar minha assinatura", "solicito o cancelamento", "quero rescindir", "não vou renovar".
NÃO considere como cancelamento: reclamações sem pedido de cancelamento, pedidos de informação, dúvidas gerais.`,
          },
          {
            role: 'user',
            content: messageContent,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('[Cancellation Detection] AI error:', aiResponse.status);
      return new Response(JSON.stringify({ detected: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const aiText = aiData.choices?.[0]?.message?.content || '';
    console.log('[Cancellation Detection] AI response:', aiText);

    // Parse AI response
    let isCancellation = false;
    let confidence = 0;
    try {
      const jsonMatch = aiText.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        isCancellation = parsed.is_cancellation === true;
        confidence = parsed.confidence || 0;
      }
    } catch (e) {
      console.error('[Cancellation Detection] Parse error:', e);
    }

    if (!isCancellation || confidence < 0.7) {
      console.log('[Cancellation Detection] Not a cancellation request. Confidence:', confidence);
      return new Response(JSON.stringify({ detected: false, confidence }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Cancellation Detection] CANCELLATION DETECTED! Confidence:', confidence);

    // Step 2: Identify the company by phone
    const phoneSuffix8 = phone.slice(-8);
    const phoneSuffix9 = phone.slice(-9);

    const { data: companies } = await supabase
      .from('onboarding_companies')
      .select('id, name, phone, cnpj')
      .or(`phone.ilike.%${phoneSuffix8},phone.ilike.%${phoneSuffix9}`);

    const companyName = companies?.[0]?.name || `Telefone: ${phone}`;
    console.log('[Cancellation Detection] Company identified:', companyName);

    // Step 3: Find the "UNV Financeiro" instance
    const { data: alertInstance } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name')
      .ilike('display_name', `%${ALERT_INSTANCE_NAME}%`)
      .maybeSingle();

    let alertInstanceName = alertInstance?.instance_name;

    // Fallback: try by instance_name if display_name didn't match
    if (!alertInstanceName) {
      const { data: fallbackInstance } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name')
        .ilike('instance_name', '%financeiro%')
        .maybeSingle();
      alertInstanceName = fallbackInstance?.instance_name;
    }

    if (!alertInstanceName) {
      // Last resort: use default instance
      const { data: defaultConfig } = await supabase
        .from('whatsapp_default_config')
        .select('setting_value')
        .eq('setting_key', 'default_instance')
        .maybeSingle();
      alertInstanceName = defaultConfig?.setting_value;
    }

    if (!alertInstanceName) {
      console.error('[Cancellation Detection] No WhatsApp instance found for alerts');
      return new Response(JSON.stringify({ detected: true, alertSent: false, error: 'No instance' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 4: Send alert messages to both numbers
    const alertMessage = `🚨 *ALERTA DE CANCELAMENTO*\n\nA empresa *${companyName}* solicitou cancelamento através do WhatsApp.\n\n📱 Telefone do contato: ${phone}\n💬 Mensagem: "${messageContent.substring(0, 200)}"\n\n⏰ Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error('[Cancellation Detection] Evolution API credentials not configured');
      return new Response(JSON.stringify({ detected: true, alertSent: false, error: 'No Evolution credentials' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/manager\/?$/i, '').replace(/\/+$/g, '');
    let sentCount = 0;

    for (const number of ALERT_NUMBERS) {
      try {
        const sendResponse = await fetch(`${baseUrl}/message/sendText/${alertInstanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            number: number,
            text: alertMessage,
          }),
        });

        if (sendResponse.ok) {
          console.log(`[Cancellation Detection] Alert sent to ${number}`);
          sentCount++;
        } else {
          const errBody = await sendResponse.text();
          console.error(`[Cancellation Detection] Failed to send to ${number}:`, sendResponse.status, errBody);
        }
      } catch (err) {
        console.error(`[Cancellation Detection] Error sending to ${number}:`, err);
      }
    }

    console.log(`[Cancellation Detection] Alerts sent: ${sentCount}/${ALERT_NUMBERS.length}`);

    return new Response(JSON.stringify({ 
      detected: true, 
      alertSent: sentCount > 0, 
      sentCount,
      companyName,
      confidence,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[Cancellation Detection] Error:', error);
    return new Response(JSON.stringify({ detected: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
