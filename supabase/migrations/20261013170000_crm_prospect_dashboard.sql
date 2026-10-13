-- Painel da Prospecção B2B no Nexus (pedido do Fabrício em 13/10/2026, igual ao do UNV Sales
-- e no molde do painel de Disparos). Aqui a prospecção é uso interno e não tem cobrança nem
-- tabela de pesquisas: o painel sai dos próprios negócios com origem "Prospecção B2B".
-- p_custo_cents é um custo de referência por empresa (padrão R$ 1,20, o preço de tabela do
-- UNV Sales) só pra dar noção de CAC e retorno.
create or replace function public.crm_prospect_dashboard(p_from date default null, p_to date default null, p_custo_cents integer default 120)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  _de timestamptz := coalesce(p_from, current_date - 29)::timestamptz;
  _ate timestamptz := (coalesce(p_to, current_date) + 1)::timestamptz;
  _custo integer := greatest(coalesce(p_custo_cents, 0), 0);
  _r jsonb;
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active) then
    raise exception 'sem acesso ao CRM';
  end if;

  with it as (
    select l.id, l.created_at as quando, l.segment, l.city, l.state, l.opportunity_value, l.pipeline_id,
           p.name as funil, s.name as etapa, s.color as cor, s.sort_order, s.final_type,
           exists (select 1 from crm_whatsapp_conversations c where c.lead_id = l.id and c.last_inbound_at is not null) as respondeu,
           exists (select 1 from crm_meeting_events m where m.lead_id = l.id) as reuniao,
           exists (select 1 from crm_meeting_events m where m.lead_id = l.id and m.event_type in ('realized', 'realized_out_of_icp')) as realizada
      from crm_leads l
      left join crm_stages s on s.id = l.stage_id
      left join crm_pipelines p on p.id = l.pipeline_id
     where l.origin = 'Prospecção B2B' and l.created_at >= _de and l.created_at < _ate
  ), tot as (
    select count(*) empresas,
           count(*) filter (where final_type is null) em_andamento,
           count(*) filter (where respondeu) responderam,
           count(*) filter (where reuniao) reunioes,
           count(*) filter (where realizada) realizadas,
           count(*) filter (where final_type = 'won') vendas,
           coalesce(sum(opportunity_value) filter (where final_type = 'won'), 0) valor_vendas,
           count(*) filter (where final_type = 'lost') perdidos
      from it
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', _de::date, 'ate', (_ate - interval '1 day')::date),
    'custo_ref_cents', _custo,
    'resumo', (select jsonb_build_object(
      'lotes', (select count(*) from (select 1 from it group by (quando at time zone 'America/Sao_Paulo')::date, pipeline_id) z),
      'empresas', empresas, 'investido_cents', empresas * _custo,
      'em_andamento', em_andamento, 'responderam', responderam, 'reunioes', reunioes, 'realizadas', realizadas,
      'vendas', vendas, 'valor_vendas', valor_vendas, 'perdidos', perdidos,
      'custo_por_reuniao_cents', case when reunioes > 0 then round(empresas * _custo::numeric / reunioes) else null end,
      'cac_cents', case when vendas > 0 then round(empresas * _custo::numeric / vendas) else null end,
      'roas', case when empresas * _custo > 0 then round(valor_vendas * 100.0 / (empresas * _custo), 2) else null end) from tot),
    'por_dia', coalesce((select jsonb_agg(x order by x->>'dia') from (
       select jsonb_build_object('dia', (quando at time zone 'America/Sao_Paulo')::date, 'empresas', count(*),
                'reunioes', count(*) filter (where reuniao), 'vendas', count(*) filter (where final_type = 'won')) x
         from it group by (quando at time zone 'America/Sao_Paulo')::date) d), '[]'::jsonb),
    'por_etapa', coalesce((select jsonb_agg(x order by (x->>'ordem')::int) from (
       select jsonb_build_object('etapa', coalesce(etapa, 'Sem etapa'), 'cor', coalesce(max(cor), '#94a3b8'),
                'qtd', count(*), 'ordem', coalesce(min(sort_order), 99999), 'final', max(final_type)) x
         from it group by coalesce(etapa, 'Sem etapa')) e), '[]'::jsonb),
    'por_segmento', coalesce((select jsonb_agg(x order by (x->>'empresas')::int desc) from (
       select jsonb_build_object('segmento', coalesce(nullif(segment, ''), 'Sem segmento'), 'empresas', count(*),
                'responderam', count(*) filter (where respondeu), 'reunioes', count(*) filter (where reuniao),
                'vendas', count(*) filter (where final_type = 'won'),
                'valor_vendas', coalesce(sum(opportunity_value) filter (where final_type = 'won'), 0)) x
         from it group by coalesce(nullif(segment, ''), 'Sem segmento') order by count(*) desc limit 15) sg), '[]'::jsonb),
    'por_cidade', coalesce((select jsonb_agg(x order by (x->>'empresas')::int desc) from (
       select jsonb_build_object('cidade', coalesce(nullif(city, ''), 'Sem cidade') || coalesce('/' || nullif(state, ''), ''), 'empresas', count(*),
                'reunioes', count(*) filter (where reuniao), 'vendas', count(*) filter (where final_type = 'won')) x
         from it group by coalesce(nullif(city, ''), 'Sem cidade') || coalesce('/' || nullif(state, ''), '') order by count(*) desc limit 12) ci), '[]'::jsonb),
    'lotes', coalesce((select jsonb_agg(x order by x->>'dia' desc) from (
       select jsonb_build_object('dia', (quando at time zone 'America/Sao_Paulo')::date, 'funil', coalesce(max(funil), 'Sem funil'),
                'empresas', count(*), 'investido_cents', count(*) * _custo,
                'responderam', count(*) filter (where respondeu), 'reunioes', count(*) filter (where reuniao),
                'vendas', count(*) filter (where final_type = 'won'),
                'valor_vendas', coalesce(sum(opportunity_value) filter (where final_type = 'won'), 0)) x
         from it group by (quando at time zone 'America/Sao_Paulo')::date, pipeline_id
         order by (quando at time zone 'America/Sao_Paulo')::date desc limit 60) lt), '[]'::jsonb)
  ) into _r;
  return _r;
end $$;
revoke all on function public.crm_prospect_dashboard(date, date, integer) from public, anon;
grant execute on function public.crm_prospect_dashboard(date, date, integer) to authenticated;
