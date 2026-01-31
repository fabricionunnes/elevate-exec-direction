import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default Evolution API credentials (fallback)
const DEFAULT_EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || '';
const DEFAULT_EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

interface Campaign {
  id: string;
  name: string;
  message_template: string;
  instance_id: string;
  status: string;
  delay_between_messages: number;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
}

interface Recipient {
  id: string;
  campaign_id: string;
  phone_number: string;
  name: string | null;
  company: string | null;
  custom_vars: Record<string, string>;
  status: string;
}

interface Instance {
  id: string;
  instance_name: string;
  status: string;
  api_url: string | null;
  api_key: string | null;
}

// Replace variables in message template
function processMessage(template: string, recipient: Recipient): string {
  let message = template;
  
  // Replace standard variables
  message = message.replace(/\{\{nome\}\}/gi, recipient.name || '');
  message = message.replace(/\{\{empresa\}\}/gi, recipient.company || '');
  message = message.replace(/\{\{telefone\}\}/gi, recipient.phone_number || '');
  
  // Replace custom variables
  if (recipient.custom_vars) {
    Object.entries(recipient.custom_vars).forEach(([key, value]) => {
      if (typeof value === 'string') {
        message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value);
      }
    });
  }
  
  // Clean up any remaining unreplaced variables
  message = message.replace(/\{\{[^}]+\}\}/g, '');
  
  return message.trim();
}

// Send message via Evolution API using instance-specific credentials
// Supports both individual contacts and groups (detected by @g.us suffix)
async function sendMessage(
  instanceName: string, 
  phone: string, 
  text: string,
  apiUrl: string,
  apiKey: string,
  isGroup: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!apiUrl || !apiKey) {
      return { success: false, error: 'Credenciais da API não configuradas para esta instância' };
    }

    let formattedNumber: string;
    
    // Check if this is a group message (JID contains @g.us)
    if (isGroup || phone.includes('@g.us')) {
      // Group JID - use as-is or ensure it has @g.us suffix
      formattedNumber = phone.includes('@') ? phone : `${phone}@g.us`;
      console.log(`[bulk-send] Sending to GROUP ${formattedNumber} via ${instanceName}`);
    } else {
      // Individual contact - format phone number
      formattedNumber = phone.replace(/\D/g, '');
      if (formattedNumber.length === 11 && formattedNumber.startsWith('0')) {
        formattedNumber = '55' + formattedNumber.substring(1);
      } else if (formattedNumber.length === 10 || formattedNumber.length === 11) {
        formattedNumber = '55' + formattedNumber;
      }
      console.log(`[bulk-send] Sending to ${formattedNumber} via ${instanceName} using API: ${apiUrl}`);
    }
    
    const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: formattedNumber,
        text: text,
      }),
    });

    const responseData = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      // Parse error message from Evolution API
      let errorMessage = `HTTP ${response.status}`;
      
      if (responseData?.response?.message) {
        const msg = responseData.response.message;
        if (Array.isArray(msg)) {
          errorMessage = msg[0];
        } else if (typeof msg === 'string') {
          errorMessage = msg;
        }
      } else if (responseData?.message) {
        errorMessage = responseData.message;
      }
      
      console.error(`[bulk-send] API error for ${formattedNumber}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }

    // Check if the number exists on WhatsApp (Evolution API v2 response)
    // Note: This check doesn't apply to groups
    if (!isGroup && responseData?.jid && responseData?.exists === false) {
      return { 
        success: false, 
        error: `Número não está no WhatsApp: ${formattedNumber}` 
      };
    }
    
    // Some error responses come with 200 status but have error info
    if (responseData?.error || responseData?.status === 'error') {
      return { 
        success: false, 
        error: responseData?.message || responseData?.error || 'Erro desconhecido' 
      };
    }

    console.log(`[bulk-send] Successfully sent to ${formattedNumber}`);
    return { success: true };
  } catch (error: any) {
    console.error('[bulk-send] Send message error:', error);
    return { success: false, error: error.message || 'Erro de conexão' };
  }
}

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { campaignId, action } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'campaignId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('whatsapp_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if campaign can be started
    if (!['draft', 'paused', 'scheduled'].includes(campaign.status)) {
      return new Response(
        JSON.stringify({ error: `Campaign cannot be started from status: ${campaign.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get instance
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', campaign.instance_id)
      .single();

    if (instanceError || !instance) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (instance.status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance is not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update campaign status to running
    await supabase
      .from('whatsapp_campaigns')
      .update({ 
        status: 'running',
        started_at: campaign.started_at || new Date().toISOString()
      })
      .eq('id', campaignId);

    // Get instance credentials - use instance-specific or fallback to global
    const instanceApiUrl = instance.api_url || DEFAULT_EVOLUTION_API_URL;
    const instanceApiKey = instance.api_key || DEFAULT_EVOLUTION_API_KEY;

    console.log(`[bulk-send] Starting campaign ${campaignId} using instance ${instance.instance_name}`);
    console.log(`[bulk-send] API URL: ${instanceApiUrl ? 'configured' : 'MISSING'}`);

    if (!instanceApiUrl || !instanceApiKey) {
      return new Response(
        JSON.stringify({ error: 'Credenciais da API não configuradas para esta instância' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update campaign status to running
    await supabase
      .from('whatsapp_campaigns')
      .update({ 
        status: 'running',
        started_at: campaign.started_at || new Date().toISOString()
      })
      .eq('id', campaignId);

    // Process in background
    EdgeRuntime.waitUntil((async () => {
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      let sentCount = campaign.sent_count || 0;
      let failedCount = campaign.failed_count || 0;

      // Get pending recipients
      const { data: recipients } = await serviceSupabase
        .from('whatsapp_campaign_recipients')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (!recipients || recipients.length === 0) {
        // Mark as completed
        await serviceSupabase
          .from('whatsapp_campaigns')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', campaignId);
        return;
      }

      for (const recipient of recipients) {
        // Check if campaign was paused or cancelled
        const { data: currentCampaign } = await serviceSupabase
          .from('whatsapp_campaigns')
          .select('status')
          .eq('id', campaignId)
          .single();

        if (currentCampaign?.status === 'paused' || currentCampaign?.status === 'cancelled') {
          console.log(`Campaign ${campaignId} was ${currentCampaign.status}, stopping...`);
          break;
        }

        // Process message (for groups, we don't replace {{nome}} with contact name)
        const message = processMessage(campaign.message_template, recipient);

        // Detect if this is a group (JID contains @g.us or custom_vars.is_group === "true")
        const isGroup = recipient.phone_number.includes('@g.us') || 
                        recipient.custom_vars?.is_group === 'true';

        // Send message with instance-specific credentials
        const result = await sendMessage(
          instance.instance_name, 
          recipient.phone_number, 
          message,
          instanceApiUrl,
          instanceApiKey,
          isGroup
        );

        if (result.success) {
          sentCount++;
          await serviceSupabase
            .from('whatsapp_campaign_recipients')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', recipient.id);
        } else {
          failedCount++;
          await serviceSupabase
            .from('whatsapp_campaign_recipients')
            .update({ 
              status: 'failed',
              error_message: result.error
            })
            .eq('id', recipient.id);
        }

        // Update campaign counts
        await serviceSupabase
          .from('whatsapp_campaigns')
          .update({ 
            sent_count: sentCount,
            failed_count: failedCount
          })
          .eq('id', campaignId);

        // Wait between messages
        await sleep(campaign.delay_between_messages * 1000);
      }

      // Check final status
      const { data: finalCampaign } = await serviceSupabase
        .from('whatsapp_campaigns')
        .select('status, total_recipients, sent_count, failed_count')
        .eq('id', campaignId)
        .single();

      if (finalCampaign && finalCampaign.status === 'running') {
        const processed = (finalCampaign.sent_count || 0) + (finalCampaign.failed_count || 0);
        if (processed >= finalCampaign.total_recipients) {
          await serviceSupabase
            .from('whatsapp_campaigns')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', campaignId);
        }
      }

      console.log(`Campaign ${campaignId} processing finished. Sent: ${sentCount}, Failed: ${failedCount}`);
    })());

    return new Response(
      JSON.stringify({ success: true, message: 'Campaign started' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
