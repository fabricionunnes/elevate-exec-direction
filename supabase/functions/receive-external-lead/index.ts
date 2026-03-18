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
    // Authenticate via x-api-key header
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('EXTERNAL_LEAD_API_KEY');

    if (!expectedKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { nome, telefone, email, empresa, faturamento, qtd_vendedores, desafio, tag } = body;

    // Validate required fields
    if (!nome || !telefone || !email) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: nome, telefone, email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get first active pipeline and its first stage
    const { data: pipeline } = await supabase
      .from('crm_pipelines')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!pipeline) {
      return new Response(JSON.stringify({ error: 'Nenhum pipeline ativo encontrado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: stage } = await supabase
      .from('crm_stages')
      .select('id')
      .eq('pipeline_id', pipeline.id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!stage) {
      return new Response(JSON.stringify({ error: 'Nenhuma etapa encontrada no pipeline' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get first active admin/master staff as owner
    const { data: owner } = await supabase
      .from('onboarding_staff')
      .select('id')
      .eq('is_active', true)
      .in('role', ['master', 'admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Try to find origin "Landing Page"
    const { data: origin } = await supabase
      .from('crm_origins')
      .select('id')
      .ilike('name', '%Landing Page%')
      .limit(1)
      .maybeSingle();

    // Build notes
    const notesParts = [];
    if (faturamento) notesParts.push(`Faturamento: ${faturamento}`);
    if (qtd_vendedores) notesParts.push(`Vendedores: ${qtd_vendedores}`);
    if (tag) notesParts.push(`Tag: ${tag}`);
    notesParts.push('Origem: Landing Page Diagnóstico');
    const notes = notesParts.join(' | ');

    const urgency = tag === 'PRIORIDADE' ? 'high' : 'medium';

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
        pipeline_id: pipeline.id,
        stage_id: stage.id,
        owner_staff_id: owner?.id || null,
        origin_id: origin?.id || null,
        entered_pipeline_at: new Date().toISOString(),
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
