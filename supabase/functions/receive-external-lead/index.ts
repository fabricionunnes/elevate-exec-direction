import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Autenticação por x-api-key (01/10/2026): vale a chave antiga do env
// EXTERNAL_LEAD_API_KEY (compatibilidade com quem já integra) OU uma chave ativa
// gerada em Configurações do CRM > API e Webhooks (tabela crm_api_keys, onde só o
// sha256 fica guardado). Chave revogada ou desconhecida = 401; chave sem a
// permissão da operação = 403. Grava last_used_at no máximo uma vez por minuto.
const REQUIRED_SCOPE = 'leads:create';

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// comparação sem atalho no primeiro caractere diferente
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type ApiAuth =
  | { ok: true; legacy: boolean; keyId: string | null; pipelineId: string | null }
  | { ok: false; status: number; error: string };

async function authenticate(req: Request, supabase: any, scope: string): Promise<ApiAuth> {
  const apiKey = (req.headers.get('x-api-key') || '').trim();
  if (!apiKey) return { ok: false, status: 401, error: 'Unauthorized' };

  const legacyKey = Deno.env.get('EXTERNAL_LEAD_API_KEY');
  if (legacyKey && safeEqual(apiKey, legacyKey)) {
    return { ok: true, legacy: true, keyId: null, pipelineId: null };
  }

  const { data: row, error } = await supabase
    .from('crm_api_keys')
    .select('id, scopes, pipeline_id, last_used_at, revoked_at')
    .eq('key_hash', await sha256Hex(apiKey))
    .maybeSingle();
  if (error) console.error('[api-key] lookup error:', error.message);
  if (!row || row.revoked_at) return { ok: false, status: 401, error: 'Unauthorized' };
  if (!(row.scopes || []).includes(scope)) {
    return { ok: false, status: 403, error: `Chave sem permissão para esta operação (${scope})` };
  }

  const last = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
  if (Date.now() - last > 60_000) {
    const { error: upErr } = await supabase
      .from('crm_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', row.id);
    if (upErr) console.error('[api-key] last_used_at error:', upErr.message);
  }
  return { ok: true, legacy: false, keyId: row.id, pipelineId: row.pipeline_id || null };
}

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const auth = await authenticate(req, supabase, REQUIRED_SCOPE);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      nome, telefone, email, empresa, faturamento, qtd_vendedores, desafio, tag,
      pipeline_id, pipeline_name, origin_name,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      meta_campaign_id, meta_adset_id, meta_ad_id,
      // dry_run: valida chave, campos e funil e responde sem criar lead nem avisar ninguém
      dry_run,
    } = body;

    if (!nome || !telefone || !email) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: nome, telefone, email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve pipeline: by id, by name, funil padrão da chave, or fallback to "Funil SE"
    let resolvedPipelineId: string | null = null;

    if (pipeline_id) {
      const { data: p } = await supabase
        .from('crm_pipelines')
        .select('id')
        .eq('id', pipeline_id)
        .eq('is_active', true)
        .maybeSingle();
      resolvedPipelineId = p?.id || null;
    }

    if (!resolvedPipelineId && pipeline_name) {
      const { data: p } = await supabase
        .from('crm_pipelines')
        .select('id')
        .eq('is_active', true)
        .ilike('name', `%${pipeline_name}%`)
        .limit(1)
        .maybeSingle();
      resolvedPipelineId = p?.id || null;
    }

    // Chave gerada pela tela pode ter um funil padrão: vale quando o corpo não escolhe um
    if (!resolvedPipelineId && auth.pipelineId) {
      const { data: p } = await supabase
        .from('crm_pipelines')
        .select('id')
        .eq('id', auth.pipelineId)
        .eq('is_active', true)
        .maybeSingle();
      resolvedPipelineId = p?.id || null;
    }

    if (!resolvedPipelineId) {
      const { data: p } = await supabase
        .from('crm_pipelines')
        .select('id')
        .eq('is_active', true)
        .ilike('name', '%Funil SE%')
        .limit(1)
        .maybeSingle();
      resolvedPipelineId = p?.id || null;
    }

    if (!resolvedPipelineId) {
      return new Response(JSON.stringify({ error: 'Pipeline não encontrado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get pipeline name
    const { data: pipelineData } = await supabase
      .from('crm_pipelines')
      .select('name')
      .eq('id', resolvedPipelineId)
      .maybeSingle();
    const resolvedPipelineName = pipelineData?.name || 'Desconhecido';

    // Get first stage of pipeline
    const { data: stage } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('pipeline_id', resolvedPipelineId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!stage) {
      return new Response(JSON.stringify({ error: 'Nenhuma etapa encontrada no pipeline' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get owner
    const { data: owner } = await supabase
      .from('onboarding_staff')
      .select('id, phone')
      .eq('is_active', true)
      .in('role', ['master', 'admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Resolve origin
    const searchOriginName = origin_name || 'Landing Page';
    const { data: origin } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', `%${searchOriginName}%`)
      .limit(1)
      .maybeSingle();

    // Build notes
    const notesParts = [];
    if (faturamento) notesParts.push(`Faturamento: ${faturamento}`);
    if (qtd_vendedores) notesParts.push(`Vendedores: ${qtd_vendedores}`);
    if (tag) notesParts.push(`Tag: ${tag}`);
    if (utm_source) notesParts.push(`UTM Source: ${utm_source}`);
    if (utm_medium) notesParts.push(`UTM Medium: ${utm_medium}`);
    if (utm_campaign) notesParts.push(`UTM Campaign: ${utm_campaign}`);
    notesParts.push(`Origem: ${searchOriginName}`);
    const notes = notesParts.join(' | ');

    const urgency = tag === 'PRIORIDADE' ? 'high' : 'medium';

    // === Deduplication: check if lead with same phone + pipeline was created in last 24h ===
    const cleanPhone = telefone.replace(/\D/g, '');
    const dedup24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingLead } = await supabase
      .from('crm_leads')
      .select('id')
      .eq('pipeline_id', resolvedPipelineId)
      .gte('created_at', dedup24h)
      .or(`phone.eq.${telefone},phone.eq.${cleanPhone},phone.ilike.%${cleanPhone.slice(-8)}%`)
      .limit(1)
      .maybeSingle();

    if (dry_run === true) {
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        pipeline_id: resolvedPipelineId,
        pipeline_name: resolvedPipelineName,
        stage_id: stage.id,
        origin_id: origin?.id || null,
        would_deduplicate: !!existingLead,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingLead) {
      console.log('[receive-external-lead] Duplicate detected, returning existing lead:', existingLead.id);
      return new Response(JSON.stringify({ success: true, lead_id: existingLead.id, deduplicated: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert lead
    const { data: lead, error: insertError } = await supabase
      .from('crm_leads')
      .insert({
        name: nome,
        phone: telefone,
        email: email,
        company: empresa || null,
        main_pain: desafio || null,
        notes: notes,
        urgency: urgency,
        pipeline_id: resolvedPipelineId,
        stage_id: stage.id,
        owner_staff_id: owner?.id || null,
        origin_id: origin?.id || null,
        entered_pipeline_at: new Date().toISOString(),
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_content: utm_content || null,
        utm_term: utm_term || null,
        meta_campaign_id: meta_campaign_id || null,
        meta_adset_id: meta_adset_id || null,
        meta_ad_id: meta_ad_id || null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[receive-external-lead] Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Erro ao inserir lead', details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[receive-external-lead] Lead created:', lead.id);

    // === Send WhatsApp notifications ===
    const APP_URL = 'https://unvholdings.com.br';
    const leadLink = `${APP_URL}/#/crm/leads/${lead.id}`;

    const formatBRPhone = (raw: string) => {
      if (!raw) return raw;
      const digits = String(raw).replace(/\D/g, '');
      let hasDDI = false;
      let clean = digits;
      if (digits.startsWith('55') && digits.length >= 12) {
        hasDDI = true;
        clean = digits.slice(2);
      }
      let formatted = raw;
      if (clean.length === 11) {
        formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
      } else if (clean.length === 10) {
        formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
      }
      return hasDDI ? `+55 ${formatted}` : formatted;
    };

    const message = `🚀 *Novo Lead Externo!*\n\n` +
      `📊 *Funil:* ${resolvedPipelineName}\n` +
      `👤 *Nome:* ${nome}\n` +
      `📞 *Telefone:* ${formatBRPhone(telefone)}\n` +
      `📧 *Email:* ${email}\n` +
      (empresa ? `🏢 *Empresa:* ${empresa}\n` : '') +
      (faturamento ? `💰 *Faturamento:* ${faturamento}\n` : '') +
      (qtd_vendedores ? `👥 *Vendedores:* ${qtd_vendedores}\n` : '') +
      (desafio ? `🎯 *Desafio:* ${desafio}\n` : '') +
      (tag ? `🏷️ *Tag:* ${tag}\n` : '') +
      (utm_source ? `📊 *Origem:* ${utm_source}\n` : '') +
      `\n🔗 *Ver no CRM:* ${leadLink}`;

    // Instância que avisa o time: a configurada em crm_settings, senão "fabricio-nunnes".
    // Credenciais: as da própria instância (whatsapp_instances), senão as globais do env.
    // ATENÇÃO: a versão em produção (v103, subida pelo Lovable) tem ainda uma credencial
    // fixa por instância dentro do código, entre a do banco e a do env. Ela NÃO veio pro
    // repositório (credencial não vai pro git). Antes de subir esta versão, garanta que a
    // instância tem api_url e api_key no banco ou que EVOLUTION_API_URL/EVOLUTION_API_KEY
    // estão nos secrets, senão o aviso de lead novo no WhatsApp para.
    const { data: instanceSetting } = await supabase
      .from('crm_settings')
      .select('setting_value')
      .eq('setting_key', 'lead_notification_instance_name')
      .maybeSingle();

    const notifInstanceName = (instanceSetting?.setting_value as string) || 'fabricio-nunnes';

    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, api_url, api_key, status')
      .eq('instance_name', notifInstanceName)
      .maybeSingle();

    const globalApiUrl = Deno.env.get('EVOLUTION_API_URL') || '';
    const globalApiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const resolvedApiUrl = (instance?.api_url || globalApiUrl).replace(/\/+$/, '');
    const resolvedApiKey = instance?.api_key || globalApiKey;
    const resolvedInstanceName = instance?.instance_name || notifInstanceName;
    console.log('[receive-external-lead] instance:', resolvedInstanceName,
      '| credenciais:', instance?.api_url ? 'da instância' : (globalApiUrl ? 'globais (env)' : 'nenhuma'));

    if (resolvedApiUrl && resolvedApiKey) {
      // Get phone numbers from staff with roles: master, head_comercial, sdr
      // SDRs are only notified if they have CRM Comercial menu access
      const { data: staffNumbers } = await supabase
        .from('onboarding_staff')
        .select('id, phone, role')
        .eq('is_active', true)
        .in('role', ['master', 'head_comercial', 'sdr'])
        .not('phone', 'is', null);

      const sdrIds = (staffNumbers || [])
        .filter((s: any) => s.role === 'sdr')
        .map((s: any) => s.id);

      let sdrsWithCrmAccess = new Set<string>();
      if (sdrIds.length > 0) {
        const { data: crmPerms } = await supabase
          .from('staff_menu_permissions')
          .select('staff_id')
          .eq('menu_key', 'crm')
          .in('staff_id', sdrIds);
        sdrsWithCrmAccess = new Set((crmPerms || []).map((p: any) => p.staff_id));
      }

      const numbersToNotify: string[] = [];

      const normalizeBRPhone = (p: string) => {
        let clean = p.replace(/\D/g, '');
        if (clean.length === 10 || clean.length === 11) clean = '55' + clean;
        if (clean.length === 12 && clean.startsWith('55')) {
          clean = clean.slice(0, 4) + '9' + clean.slice(4);
        }
        return clean;
      };

      if (staffNumbers) {
        for (const s of staffNumbers) {
          if (s.role === 'sdr' && !sdrsWithCrmAccess.has(s.id)) continue;
          const clean = normalizeBRPhone(s.phone || '');
          if (clean && !numbersToNotify.includes(clean)) numbersToNotify.push(clean);
        }
      }

      // Also include crm_lead_notification_numbers as fallback
      const { data: notifNumbers } = await supabase
        .from('crm_lead_notification_numbers')
        .select('phone')
        .eq('is_active', true);

      if (notifNumbers) {
        for (const n of notifNumbers) {
          const cleanPhone = normalizeBRPhone(n.phone || '');
          if (cleanPhone && !numbersToNotify.includes(cleanPhone)) {
            numbersToNotify.push(cleanPhone);
          }
        }
      }

      console.log('[receive-external-lead] Numbers to notify:', numbersToNotify);

      // Manager V2 (stevo.chat) usa /send/text; Evolution API padrão usa /message/sendText/<instância>
      const isManagerV2 = resolvedApiUrl.endsWith('.stevo.chat');
      const sendUrl = isManagerV2
        ? `${resolvedApiUrl}/send/text`
        : `${resolvedApiUrl}/message/sendText/${resolvedInstanceName}`;

      for (const phone of numbersToNotify) {
        try {
          const resp = await fetch(sendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': resolvedApiKey,
            },
            body: JSON.stringify({ number: phone, text: message }),
          });
          const respText = await resp.text();
          console.log(`[receive-external-lead] WhatsApp to ${phone}: ${resp.status} ${respText.substring(0, 120)}`);
        } catch (whatsappError) {
          console.error(`[receive-external-lead] WhatsApp error for ${phone}:`, whatsappError);
        }
      }
    } else {
      console.warn('[receive-external-lead] Sem credenciais de WhatsApp pra avisar o time. instance:', notifInstanceName);
    }

    // === Fire automation engine for lead_created ===
    try {
      await supabase.functions.invoke("automation-engine", {
        body: {
          trigger_type: "lead_created",
          trigger_data: {
            lead_id: lead.id,
            lead_name: nome,
            lead_phone: telefone,
            company_name: empresa || "",
            pipeline_id: resolvedPipelineId,
            pipeline_name: resolvedPipelineName,
          },
        },
      });
    } catch (autoErr) {
      console.error("[receive-external-lead] Automation engine error:", autoErr);
    }

    // === Enqueue CRM message rules (régua de mensagens para o cliente) ===
    try {
      await supabase.functions.invoke("crm-message-queue", {
        body: {
          action: "enqueue",
          trigger_type: "lead_created",
          lead_id: lead.id,
          lead_name: nome,
          lead_phone: telefone,
          lead_email: email || "",
          company_name: empresa || "",
          pipeline_id: resolvedPipelineId,
          pipeline_name: resolvedPipelineName,
          stage_id: stage.id,
          stage_name: "",
        },
      });
    } catch (queueErr) {
      console.error("[receive-external-lead] Message queue error:", queueErr);
    }

    return new Response(JSON.stringify({ success: true, lead_id: lead.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[receive-external-lead] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
