-- Painel de Controle, resultados dos clientes: duas regras pedidas pelo Fabrício em 15/10/2026.
-- 1) Empresa com "meta não é necessária" (onboarding_companies.goal_not_required) fica FORA do card,
--    da lista e dos alertas: não pode aparecer como sem meta ou sem resultado.
-- 2) Facunicamps (quem tem matrículas em facunicamps_matriculas) usa o menu Indicadores, não os KPIs:
--    realizado = matrículas do mês (cancelados incluídos, igual ao painel dela); meta = soma das metas
--    por vendedor do mês, senão a meta geral do mês (facunicamps_metas_vendedor / facunicamps_metas).

create or replace function public.painel_facunicamps_mes(p_company uuid, p_mes date)
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select jsonb_build_object(
    'meta', coalesce(
      (select nullif(sum(v.meta), 0) from facunicamps_metas_vendedor v where date_trunc('month', v.mes) = date_trunc('month', p_mes)),
      (select nullif(max(m.meta), 0) from facunicamps_metas m where date_trunc('month', m.mes) = date_trunc('month', p_mes))),
    'realizado', (select count(*) from facunicamps_matriculas x where x.company_id = p_company
                    and x.data_venda >= date_trunc('month', p_mes) and x.data_venda < date_trunc('month', p_mes) + interval '1 month'),
    'ultimo', (select max(x.data_venda) from facunicamps_matriculas x where x.company_id = p_company
                 and x.data_venda < date_trunc('month', p_mes) + interval '1 month'));
$function$;

create or replace function public.painel_resultado_indicadores_interno(p_month date, p_company uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_ini date := date_trunc('month', p_month)::date;
  v_fim date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_mes text := to_char(date_trunc('month', p_month), 'YYYY-MM');
  f jsonb := painel_facunicamps_mes(p_company, p_month);
  res jsonb;
begin
  select jsonb_build_object(
    'mes', v_mes,
    'ritmo', painel_ritmo_mes(p_month),
    'fonte', 'indicadores',
    'empresa', c.name, 'company_id', c.id,
    'project_id', (select p.id from onboarding_projects p where p.onboarding_company_id = c.id
                    and p.status in ('active','notice_period','cancellation_signaled') order by p.created_at desc limit 1),
    'consultor', (select s.name from onboarding_staff s where s.id = c.consultant_id),
    'kpi_id', null,
    'kpis', jsonb_build_array(jsonb_build_object(
        'kpi_id', null, 'kpi', 'Matrículas (Indicadores)', 'tipo', 'numeric', 'principal', true,
        'meta', f->'meta', 'realizado', f->'realizado', 'lanc_mes', f->'realizado', 'ultimo', f->'ultimo')),
    'vendedores', (select coalesce(jsonb_agg(jsonb_build_object(
          'salesperson_id', v.vendedor, 'nome', v.vendedor, 'ativo', true, 'meta', v.meta,
          'realizado', v.realizado, 'lanc_mes', v.realizado, 'ultimo', v.ultimo)
        order by v.realizado desc nulls last, v.vendedor), '[]') from (
        select coalesce(mv.vendedor, mt.vendedor) vendedor, nullif(mv.meta, 0) meta, coalesce(mt.n, 0) realizado, mt.ultimo
          from (select vendedor, sum(meta) meta from facunicamps_metas_vendedor
                 where date_trunc('month', mes) = date_trunc('month', p_month) group by 1) mv
          full join (select vendedor, count(*) n, max(data_venda) ultimo from facunicamps_matriculas
                      where company_id = p_company and data_venda >= v_ini and data_venda < v_fim group by 1) mt
            on mt.vendedor = mv.vendedor) v),
    'sem_vendedor', null,
    'diario', (select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'valor', d.n) order by d.dia), '[]') from (
        select data_venda dia, count(*) n from facunicamps_matriculas
         where company_id = p_company and data_venda >= v_ini and data_venda < v_fim group by 1) d),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object(
                'mes', to_char(m, 'YYYY-MM'),
                'meta', painel_facunicamps_mes(p_company, m::date)->'meta',
                'realizado', painel_facunicamps_mes(p_company, m::date)->'realizado') order by m), '[]')
              from generate_series(date_trunc('month', p_month) - interval '5 months', date_trunc('month', p_month), interval '1 month') m)
  ) into res
  from onboarding_companies c where c.id = p_company;
  return res;
end $function$;

create or replace function public.painel_resultados_interno(p_month date)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_ini date := date_trunc('month', p_month)::date;
  v_fim date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_mes text := to_char(date_trunc('month', p_month), 'YYYY-MM');
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  rit jsonb := painel_ritmo_mes(p_month);
  r numeric := (rit->>'ritmo')::numeric;
  res jsonb;
begin
  with emp as (
    select c.id, c.name, c.consultant_id,
           (select p.id from onboarding_projects p where p.onboarding_company_id = c.id
               and p.status in ('active','notice_period','cancellation_signaled') order by p.created_at desc limit 1) project_id,
           exists (select 1 from onboarding_projects p where p.onboarding_company_id = c.id
               and p.status in ('notice_period','cancellation_signaled')) em_aviso
      from onboarding_companies c
     where c.status = 'active' and coalesce(c.is_simulator,false) = false and c.tenant_id is null
       and coalesce(c.goal_not_required, false) = false   -- "meta não é necessária" no cadastro: fica fora do card
       and exists (select 1 from onboarding_projects p where p.onboarding_company_id = c.id
                     and p.status in ('active','notice_period','cancellation_signaled'))
  ), base as (
    select e.*, painel_kpi_principal(e.id) kid,
           exists (select 1 from facunicamps_matriculas fm where fm.company_id = e.id) indicadores
      from emp e
  ), calc as (
    select b.*,
           case when b.indicadores then 'Matrículas (Indicadores)' else k.name end kpi,
           case when b.indicadores then 'numeric' else k.kpi_type end tipo,
           s.name consultor,
           case when b.indicadores then (painel_facunicamps_mes(b.id, v_ini)->>'meta')::numeric else painel_kpi_meta_mes(b.kid, v_mes) end meta,
           case when b.indicadores then (painel_facunicamps_mes(b.id, v_ini)->>'realizado')::numeric
                else (select sum(en.value) from kpi_entries en where en.kpi_id = b.kid and en.entry_date >= v_ini and en.entry_date < v_fim) end realizado,
           case when b.indicadores then (painel_facunicamps_mes(b.id, v_ini)->>'realizado')::int
                else (select count(*) from kpi_entries en where en.kpi_id = b.kid and en.entry_date >= v_ini and en.entry_date < v_fim) end lanc_mes,
           case when b.indicadores then (painel_facunicamps_mes(b.id, v_ini)->>'ultimo')::date
                else (select max(en.entry_date) from kpi_entries en where en.kpi_id = b.kid and en.entry_date < v_fim) end ultimo
      from base b
      left join company_kpis k on k.id = b.kid
      left join onboarding_staff s on s.id = b.consultant_id
  ), fim as (
    select c.*,
           case when c.meta > 0 and c.lanc_mes > 0 then round(coalesce(c.realizado,0) / c.meta, 4) end pct,
           case when c.ultimo is not null and hoje < v_fim then hoje - c.ultimo end dias_sem_lancar,
           case
             when c.kid is null and not c.indicadores then 'sem_kpi'
             when c.lanc_mes = 0 and c.meta is null then 'sem_nada'
             when c.lanc_mes = 0 then 'sem_resultado'
             when c.meta is null then 'sem_meta'
             when coalesce(c.realizado,0) >= c.meta then 'batida'
             when r = 0 or coalesce(c.realizado,0) / c.meta >= r * 0.9 then 'no_ritmo'
             when coalesce(c.realizado,0) / c.meta >= r * 0.7 then 'atencao'
             else 'abaixo'
           end situacao
      from calc c
  )
  select jsonb_build_object(
    'mes', v_mes,
    'ritmo', rit,
    'meta_nao_necessaria', (select count(*) from onboarding_companies c where c.status = 'active' and c.tenant_id is null
                              and coalesce(c.is_simulator,false) = false and c.goal_not_required),
    'clientes', coalesce(jsonb_agg(jsonb_build_object(
        'company_id', f.id, 'empresa', f.name, 'project_id', f.project_id, 'em_aviso', f.em_aviso,
        'consultant_id', f.consultant_id, 'consultor', f.consultor,
        'kpi_id', f.kid, 'kpi', f.kpi, 'tipo', f.tipo, 'fonte', case when f.indicadores then 'indicadores' else 'kpis' end,
        'meta', f.meta, 'realizado', f.realizado, 'pct', f.pct,
        'lanc_mes', f.lanc_mes, 'ultimo', f.ultimo, 'dias_sem_lancar', f.dias_sem_lancar,
        'situacao', f.situacao)
      order by array_position(array['sem_nada','sem_resultado','sem_meta','sem_kpi','abaixo','atencao','no_ritmo','batida'], f.situacao), f.pct nulls first, f.name), '[]')
  ) into res
  from fim f;
  return res;
end $function$;

create or replace function public.painel_resultado_cliente_interno(p_month date, p_company uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_ini date := date_trunc('month', p_month)::date;
  v_fim date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_mes text := to_char(date_trunc('month', p_month), 'YYYY-MM');
  v_kid uuid := painel_kpi_principal(p_company);
  res jsonb;
begin
  -- Facunicamps: meta e resultado vêm do menu Indicadores (matrículas), não dos KPIs (pedido do Fabrício, 15/10/2026)
  if exists (select 1 from facunicamps_matriculas fm where fm.company_id = p_company) then
    return painel_resultado_indicadores_interno(p_month, p_company);
  end if;
  select jsonb_build_object(
    'mes', v_mes,
    'ritmo', painel_ritmo_mes(p_month),
    'empresa', c.name, 'company_id', c.id,
    'project_id', (select p.id from onboarding_projects p where p.onboarding_company_id = c.id
                    and p.status in ('active','notice_period','cancellation_signaled') order by p.created_at desc limit 1),
    'consultor', (select s.name from onboarding_staff s where s.id = c.consultant_id),
    'kpi_id', v_kid,
    'kpis', (select coalesce(jsonb_agg(jsonb_build_object(
                'kpi_id', k.id, 'kpi', k.name, 'tipo', k.kpi_type, 'principal', k.id = v_kid,
                'meta', painel_kpi_meta_mes(k.id, v_mes),
                'realizado', (select sum(en.value) from kpi_entries en where en.kpi_id = k.id and en.entry_date >= v_ini and en.entry_date < v_fim),
                'lanc_mes', (select count(*) from kpi_entries en where en.kpi_id = k.id and en.entry_date >= v_ini and en.entry_date < v_fim),
                'ultimo', (select max(en.entry_date) from kpi_entries en where en.kpi_id = k.id and en.entry_date < v_fim))
              order by k.id = v_kid desc, k.sort_order nulls last, k.name), '[]')
             from company_kpis k where k.company_id = c.id and k.is_active),
    'vendedores', (select coalesce(jsonb_agg(x order by (x->>'realizado')::numeric desc nulls last, x->>'nome'), '[]') from (
        select jsonb_build_object(
          'salesperson_id', sp.id, 'nome', sp.name, 'ativo', sp.is_active,
          'meta', (select nullif(sum(t.target_value),0) from kpi_monthly_targets t
                    where t.kpi_id = v_kid and t.month_year = v_mes and t.level_order = 1 and t.salesperson_id = sp.id),
          'realizado', (select sum(en.value) from kpi_entries en where en.kpi_id = v_kid and en.salesperson_id = sp.id and en.entry_date >= v_ini and en.entry_date < v_fim),
          'lanc_mes', (select count(*) from kpi_entries en where en.kpi_id = v_kid and en.salesperson_id = sp.id and en.entry_date >= v_ini and en.entry_date < v_fim),
          'ultimo', (select max(en.entry_date) from kpi_entries en where en.kpi_id = v_kid and en.salesperson_id = sp.id and en.entry_date < v_fim)) x
          from company_salespeople sp
         where sp.company_id = c.id
           and (sp.is_active
                or exists (select 1 from kpi_entries en where en.kpi_id = v_kid and en.salesperson_id = sp.id and en.entry_date >= v_ini and en.entry_date < v_fim)
                or exists (select 1 from kpi_monthly_targets t where t.kpi_id = v_kid and t.month_year = v_mes and t.salesperson_id = sp.id))
      ) v),
    'sem_vendedor', (select sum(en.value) from kpi_entries en where en.kpi_id = v_kid and en.salesperson_id is null and en.entry_date >= v_ini and en.entry_date < v_fim),
    'diario', (select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'valor', d.v) order by d.dia), '[]') from (
        select en.entry_date dia, sum(en.value) v from kpi_entries en
         where en.kpi_id = v_kid and en.entry_date >= v_ini and en.entry_date < v_fim group by 1) d),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object(
                'mes', to_char(m, 'YYYY-MM'),
                'meta', painel_kpi_meta_mes(v_kid, to_char(m, 'YYYY-MM')),
                'realizado', (select sum(en.value) from kpi_entries en where en.kpi_id = v_kid
                               and en.entry_date >= m and en.entry_date < (m + interval '1 month')::date)) order by m), '[]')
              from generate_series(date_trunc('month', p_month) - interval '5 months', date_trunc('month', p_month), interval '1 month') m)
  ) into res
  from onboarding_companies c where c.id = p_company;
  return res;
end $function$;

revoke all on function public.painel_facunicamps_mes(uuid, date) from public, anon, authenticated;
revoke all on function public.painel_resultado_indicadores_interno(date, uuid) from public, anon, authenticated;

create index if not exists idx_facunicamps_matriculas_company_data on public.facunicamps_matriculas (company_id, data_venda);
