import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('EXTERNAL_LEAD_API_KEY');

    if (!expectedKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { lead_id, status, opportunity_value, closer_staff_id, notes } = body;

    if (!lead_id) {
      return new Response(JSON.stringify({ error: 'Campo obrigatório: lead_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!status || !['won', 'lost'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Campo obrigatório: status (won ou lost)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Verify lead exists and get its pipeline
    const { data: lead, error: leadError } = await supabase
      .from('crm_leads')
      .select('id, pipeline_id, name, phone, email')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: 'Lead não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Find the target stage (won or lost) in the lead's pipeline
    const finalType = status === 'won' ? 'won' : 'lost';
    const { data: targetStage } = await supabase
      .from('crm_stages')
      .select('id, name')
      .eq('pipeline_id', lead.pipeline_id)
      .eq('final_type', finalType)
      .limit(1)
      .maybeSingle();

    if (!targetStage) {
      return new Response(JSON.stringify({ 
        error: `Etapa "${finalType}" não encontrada no pipeline do lead` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Build update data
    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      stage_id: targetStage.id,
      closed_at: now,
    };

    if (opportunity_value !== undefined && opportunity_value !== null) {
      updateData.opportunity_value = opportunity_value;
    }

    if (closer_staff_id) {
      updateData.closer_staff_id = closer_staff_id;
    }

    if (notes) {
      updateData.notes = notes;
    }

    if (status === 'lost') {
      updateData.lost_at = now;
    }

    // 4. Update the lead
    const { error: updateError } = await supabase
      .from('crm_leads')
      .update(updateData)
      .eq('id', lead_id);

    if (updateError) {
      console.error('[update-lead-status] Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Erro ao atualizar lead', details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[update-lead-status] Lead ${lead_id} marked as ${status}`);

    // 5. If won, send notification (optional, best-effort)
    if (status === 'won') {
      try {
        // Load won notification settings
        const { data: settings } = await supabase
          .from('crm_settings')
          .select('setting_key, setting_value')
          .in('setting_key', [
            'won_notification_enabled',
            'won_notification_instance_id',
            'won_notification_group_jid',
          ]);

        const config: Record<string, string | null> = {};
        (settings || []).forEach(s => {
          config[s.setting_key] = s.setting_value as string;
        });

        if (config.won_notification_enabled === 'true' && config.won_notification_instance_id && config.won_notification_group_jid) {
          // Send notification via evolution-api edge function
          await supabase.functions.invoke('evolution-api', {
            body: {
              action: 'sendGroupText',
              instanceId: config.won_notification_instance_id,
              groupId: config.won_notification_group_jid,
              message: `🎉 *NOVA VENDA FECHADA (via API)!*\n\n👤 *Lead:* ${lead.name || 'N/A'}\n📱 *Telefone:* ${lead.phone || 'N/A'}\n✉️ *Email:* ${lead.email || 'N/A'}${opportunity_value ? `\n💵 *Valor:* R$ ${Number(opportunity_value).toLocaleString('pt-BR')}` : ''}`,
            },
          });
        }
      } catch (notifError) {
        console.error('[update-lead-status] Notification error (non-blocking):', notifError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      lead_id: lead_id,
      status: status,
      stage: targetStage.name,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[update-lead-status] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
