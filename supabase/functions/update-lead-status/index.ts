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
    const {
      lead_id,
      status,
      opportunity_value,
      closer_staff_id,
      notes,
      // Financial fields
      paid_value,
      bank_id,
      bank_account_id,
      payment_method,
      description,
      company_id,
    } = body;

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

    // 1. Verify lead exists and get its pipeline + data
    const { data: lead, error: leadError } = await supabase
      .from('crm_leads')
      .select('id, pipeline_id, name, phone, email, company, opportunity_value')
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
    const today = now.split('T')[0];
    const finalValue = opportunity_value ?? paid_value ?? lead.opportunity_value;

    const updateData: Record<string, any> = {
      stage_id: targetStage.id,
      closed_at: now,
    };

    if (finalValue !== undefined && finalValue !== null) {
      updateData.opportunity_value = finalValue;
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

    // 5. If won + paid_value, create financial receivable as paid + bank transaction
    let receivableId: string | null = null;
    let bankName: string | null = null;

    if (status === 'won' && paid_value && paid_value > 0) {
      const receivableDescription = description || `Venda: ${lead.company || lead.name || 'Lead'} (via API)`;
      const amountCents = Math.round(paid_value * 100);
      const apiInvoiceNote = `Lead ID: ${lead.id} | Lead: ${lead.name || ''} | Criado via API`;

      // Validate bank_id if provided
      if (bank_id) {
        const { data: bank } = await supabase
          .from('financial_banks')
          .select('id, name')
          .eq('id', bank_id)
          .eq('is_active', true)
          .maybeSingle();

        if (!bank) {
          return new Response(JSON.stringify({ error: 'Banco não encontrado ou inativo' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        bankName = bank.name;
      }

      let duplicateInvoiceQuery = supabase
        .from('company_invoices')
        .select('id')
        .eq('description', receivableDescription)
        .eq('amount_cents', amountCents)
        .eq('due_date', today)
        .eq('status', 'paid')
        .limit(1);

      duplicateInvoiceQuery = company_id
        ? duplicateInvoiceQuery.eq('company_id', company_id)
        : duplicateInvoiceQuery.is('company_id', null);

      if (bank_id) {
        duplicateInvoiceQuery = duplicateInvoiceQuery.eq('bank_id', bank_id);
      }

      const { data: existingInvoice } = await duplicateInvoiceQuery.maybeSingle();

      if (existingInvoice) {
        receivableId = existingInvoice.id;
        console.log(`[update-lead-status] Duplicate invoice skipped for lead ${lead_id}: ${existingInvoice.id}`);
      } else {
        const { data: invoice, error: recError } = await supabase
          .from('company_invoices')
          .insert({
            amount_cents: amountCents,
            paid_amount_cents: amountCents,
            description: receivableDescription,
            due_date: today,
            paid_at: now,
            status: 'paid',
            company_id: company_id || null,
            custom_receiver_name: !company_id ? (lead.company || lead.name || null) : null,
            payment_method: payment_method || 'pix',
            bank_id: bank_id || null,
            notes: apiInvoiceNote,
          })
          .select('id')
          .single();

        if (recError) {
          console.error('[update-lead-status] Invoice error:', recError);
        } else {
          receivableId = invoice.id;
          console.log(`[update-lead-status] Invoice created: ${invoice.id}`);

          if (bank_id) {
            await supabase.rpc('increment_bank_balance' as any, {
              p_bank_id: bank_id,
              p_amount: amountCents,
            });

            await supabase.from('financial_bank_transactions').insert({
              bank_id: bank_id,
              type: 'credit',
              amount_cents: amountCents,
              description: receivableDescription,
              reference_type: 'invoice',
              reference_id: receivableId,
            } as any);

            console.log(`[update-lead-status] Bank credited: ${bank_id} +${amountCents} cents`);
          }
        }
      }
    }

    // 6. If won, send notification (optional, best-effort)
    if (status === 'won') {
      try {
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
          const valueStr = paid_value ? `\n💵 *Valor pago:* R$ ${Number(paid_value).toLocaleString('pt-BR')}` : 
                          (finalValue ? `\n💵 *Valor:* R$ ${Number(finalValue).toLocaleString('pt-BR')}` : '');
          const bankStr = bankName ? `\n🏦 *Banco:* ${bankName}` : '';

          await supabase.functions.invoke('evolution-api', {
            body: {
              action: 'sendGroupText',
              instanceId: config.won_notification_instance_id,
              groupId: config.won_notification_group_jid,
              message: `🎉 *NOVA VENDA FECHADA (via API)!*\n\n👤 *Lead:* ${lead.name || 'N/A'}\n📱 *Telefone:* ${lead.phone || 'N/A'}\n🏢 *Empresa:* ${lead.company || 'N/A'}${valueStr}${bankStr}`,
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
      receivable_id: receivableId,
      bank: bankName,
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
