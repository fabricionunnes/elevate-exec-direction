-- Painel de mini-eventos lendo o Meta direto: a função mini-evento grava cliques, gasto e impressões por anúncio
-- em miniev_turmas.meta_vivo a cada poucos minutos; o painel usa essa leitura quando ela existe.
alter table public.miniev_turmas add column if not exists meta_vivo jsonb, add column if not exists meta_vivo_em timestamptz;

CREATE OR REPLACE FUNCTION public.miniev_painel_interno(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t miniev_turmas%rowtype;
  v_desde timestamptz;
  v_ads jsonb; v_leads jsonb; v_etapas jsonb; v_dias jsonb; v_fila jsonb; v_abertos jsonb; v_recentes jsonb; v_insc jsonb;
  v_gasto numeric; v_cliques numeric; v_impr numeric; v_n_leads int; v_pagina int; v_checkout int; v_pagos int; v_receita numeric; v_presentes int;
begin
  select * into t from miniev_turmas where slug = p_slug;
  if not found then return null; end if;
  -- leads da turma: do que vier primeiro, a criação da turma ou 10 dias antes de abrir a venda (o teste de promessa roda antes)
  v_desde := least(t.criado_em, coalesce(t.venda_desde::timestamptz, t.criado_em) - interval '10 days') - interval '1 hour';

  -- anúncios: gasto, cliques e leads do Meta por nome de anúncio + leads e ingressos do CRM
  with gasto as (
    select upper(ad_name) as chave, max(ad_name) as nome, max(adset_name) as conjunto,
           sum(spend) as gasto, sum(clicks) as cliques, sum(impressions) as impressoes
    from (
      -- leitura direta do Meta a cada poucos minutos (meta_vivo); sem ela, a sincronização de 2 em 2 horas do CRM
      select ad_name, adset_name, spend, clicks::numeric as clicks, impressions::numeric as impressions
        from crm_meta_ads_ads where campaign_id = any(t.meta_campaign_ids) and t.meta_vivo is null
      union all
      select r.ad_name, r.adset_name, r.spend, r.clicks, r.impressions
        from jsonb_to_recordset(coalesce(t.meta_vivo, '[]'::jsonb)) as r(ad_name text, adset_name text, spend numeric, clicks numeric, impressions numeric)
    ) x group by 1
  ), l as (
    select upper(coalesce(l.ad_name, '')) as chave, count(*) as leads,
           count(*) filter (where exists (select 1 from miniev_inscricoes i where i.lead_id = l.id and i.turma_id = t.id and i.status = 'pago')) as vendas
    from crm_leads l where l.pipeline_id = t.pipeline_id and l.created_at >= v_desde group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object('anuncio', g.nome, 'conjunto', g.conjunto, 'gasto', g.gasto, 'cliques', g.cliques,
           'impressoes', g.impressoes, 'leads', coalesce(l.leads, 0), 'vendas', coalesce(l.vendas, 0)) order by g.cliques desc nulls last), '[]'::jsonb),
         coalesce(sum(g.gasto), 0), coalesce(sum(g.cliques), 0), coalesce(sum(g.impressoes), 0)
    into v_ads, v_gasto, v_cliques, v_impr
  from gasto g left join l on l.chave = g.chave;

  select count(*) into v_n_leads from crm_leads where pipeline_id = t.pipeline_id and created_at >= v_desde;
  select coalesce(jsonb_agg(jsonb_build_object('etapa', s.name, 'ordem', s.sort_order, 'cor', s.color,
           'leads', (select count(*) from crm_leads l where l.stage_id = s.id and l.created_at >= v_desde)) order by s.sort_order), '[]'::jsonb)
    into v_etapas from crm_stages s where s.pipeline_id = t.pipeline_id;

  select count(distinct coalesce(sessao, id::text)) into v_pagina from miniev_eventos where turma_id = t.id and tipo = 'pagina_vista';
  select count(*) into v_checkout from miniev_inscricoes where turma_id = t.id;
  select count(*), coalesce(sum(valor_cents), 0) / 100.0, count(*) filter (where presente_em is not null)
    into v_pagos, v_receita, v_presentes from miniev_inscricoes where turma_id = t.id and status = 'pago';

  select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'vendas', n, 'receita', r) order by d), '[]'::jsonb) into v_dias from (
    select (pago_em at time zone 'America/Sao_Paulo')::date as d, count(*) as n, sum(valor_cents) / 100.0 as r
    from miniev_inscricoes where turma_id = t.id and status = 'pago' group by 1) x;

  -- fila: lead que ainda está na primeira etapa (ninguém chamou) e checkout aberto sem pagamento
  select coalesce(jsonb_agg(jsonb_build_object('lead_id', l.id, 'nome', l.name, 'telefone', l.phone, 'anuncio', l.ad_name,
           'minutos', floor(extract(epoch from now() - l.created_at) / 60)) order by l.created_at), '[]'::jsonb)
    into v_fila from (
      select l.* from crm_leads l join crm_stages s on s.id = l.stage_id
      where l.pipeline_id = t.pipeline_id and l.created_at >= v_desde and s.sort_order = 0 order by l.created_at limit 60) l;
  select coalesce(jsonb_agg(jsonb_build_object('inscricao_id', i.id, 'lead_id', i.lead_id, 'nome', i.nome, 'telefone', i.telefone,
           'valor', i.valor_cents / 100.0, 'minutos', floor(extract(epoch from now() - i.criado_em) / 60)) order by i.criado_em), '[]'::jsonb)
    into v_abertos from miniev_inscricoes i
    where i.turma_id = t.id and i.status = 'checkout'
      and not exists (select 1 from miniev_inscricoes p where p.turma_id = t.id and p.status = 'pago' and p.telefone = i.telefone);

  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'lead_id', i.lead_id, 'nome', i.nome, 'telefone', i.telefone, 'com_socio', i.com_socio,
           'socio_nome', i.socio_nome, 'valor', i.valor_cents / 100.0, 'pago_em', i.pago_em, 'presente_em', i.presente_em) order by i.nome), '[]'::jsonb)
    into v_insc from miniev_inscricoes i where i.turma_id = t.id and i.status = 'pago';

  select coalesce(jsonb_agg(x order by (x->>'em') desc), '[]'::jsonb) into v_recentes from (
    select jsonb_build_object('id', e.id, 'tipo', e.tipo, 'em', e.em, 'nome', coalesce(i.nome, l.name), 'dados', e.dados) as x
    from miniev_eventos e left join miniev_inscricoes i on i.id = e.inscricao_id left join crm_leads l on l.id = e.lead_id
    where e.turma_id = t.id order by e.em desc limit 40) y;

  return jsonb_build_object(
    'turma', to_jsonb(t),
    'placar', jsonb_build_object('cliques', v_cliques, 'impressoes', v_impr, 'gasto', v_gasto, 'leads', v_n_leads, 'pagina', v_pagina,
              'checkout', v_checkout, 'ingressos', v_pagos, 'receita', v_receita, 'presentes', v_presentes),
    'anuncios', v_ads, 'etapas', v_etapas, 'dias', v_dias, 'fila', v_fila, 'checkouts_abertos', v_abertos,
    'inscritos', v_insc, 'recentes', v_recentes, 'agora', now());
end $function$;
