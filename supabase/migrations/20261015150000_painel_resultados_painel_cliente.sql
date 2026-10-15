-- Painel de Controle, resultados dos clientes (15/10/2026, Fabrício: "o Vitor Jaci, a meta fica no
-- menu painel de controle e não no KPI, então considerar ela").
-- Cliente cujo projeto tem "Painel de controle" (project_custom_dashboards) com meta cadastrada em
-- dados.sistema.metas['AAAA-MM'] usa esse painel: meta = metas[mês].total; realizado = soma das
-- vendas do mês (dados.meses[].vd, valor na posição 0 e data na 7), a mesma conta do bloco
-- "Meta do mês" do painel. Ordem das fontes: Indicadores (Facunicamps) > Painel de controle > KPIs.

-- projeto do cliente com Painel de controle que tem meta (null = não usa)
create or replace function public.painel_projeto_com_meta(p_company uuid)
 returns uuid language sql stable security definer set search_path to 'public'
as $function$
  select d.project_id from project_custom_dashboards d join onboarding_projects p on p.id = d.project_id
   where p.onboarding_company_id = p_company
     and jsonb_typeof(d.dados->'sistema'->'metas') = 'object' and d.dados->'sistema'->'metas' <> '{}'::jsonb
   order by d.updated_at desc nulls last limit 1;
$function$;

-- meta, realizado, nº de vendas e última venda de um mês no Painel de controle do projeto
create or replace function public.painel_painelcliente_mes(p_project uuid, p_mes date)
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  with d as (select dados from project_custom_dashboards where project_id = p_project order by updated_at desc nulls last limit 1),
  vd as (
    select (v->>0)::numeric valor, (v->>7)::date dia, v->>2 closer
      from d, jsonb_array_elements(d.dados->'meses') m, jsonb_array_elements(coalesce(m->'vd', '[]'::jsonb)) v
     where (d.dados->>'ano')::int = extract(year from p_mes) and (m->>'n')::int = extract(month from p_mes)
  )
  select jsonb_build_object(
    'meta', (select nullif((d.dados->'sistema'->'metas'->to_char(p_mes, 'YYYY-MM')->>'total')::numeric, 0) from d),
    'realizado', (select sum(valor) from vd),
    'n', (select count(*) from vd),
    'ultimo', (select max(dia) from vd));
$function$;

create or replace function public.painel_resultado_painelcliente_interno(p_month date, p_company uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_pid uuid := painel_projeto_com_meta(p_company);
  v_mes text := to_char(date_trunc('month', p_month), 'YYYY-MM');
  f jsonb := painel_painelcliente_mes(v_pid, p_month);
  res jsonb;
begin
  with d as (select dados from project_custom_dashboards where project_id = v_pid order by updated_at desc nulls last limit 1),
  vd as (
    select (v->>0)::numeric valor, (v->>7)::date dia, coalesce(nullif(v->>2, ''), 'Sem closer') closer
      from d, jsonb_array_elements(d.dados->'meses') m, jsonb_array_elements(coalesce(m->'vd', '[]'::jsonb)) v
     where (d.dados->>'ano')::int = extract(year from p_month) and (m->>'n')::int = extract(month from p_month)
  )
  select jsonb_build_object(
    'mes', v_mes,
    'ritmo', painel_ritmo_mes(p_month),
    'fonte', 'painel',
    'empresa', c.name, 'company_id', c.id,
    'project_id', v_pid,
    'consultor', (select s.name from onboarding_staff s where s.id = c.consultant_id),
    'kpi_id', null,
    'kpis', jsonb_build_array(jsonb_build_object(
        'kpi_id', null, 'kpi', 'Vendas (Painel de controle)', 'tipo', 'monetary', 'principal', true,
        'meta', f->'meta', 'realizado', f->'realizado', 'lanc_mes', f->'n', 'ultimo', f->'ultimo')),
    'vendedores', (select coalesce(jsonb_agg(jsonb_build_object(
          'salesperson_id', x.closer, 'nome', x.closer, 'ativo', true, 'meta', null,
          'realizado', x.v, 'lanc_mes', x.n, 'ultimo', x.ult) order by x.v desc), '[]')
        from (select closer, sum(valor) v, count(*) n, max(dia) ult from vd group by 1) x),
    'sem_vendedor', null,
    'diario', (select coalesce(jsonb_agg(jsonb_build_object('dia', x.dia, 'valor', x.v) order by x.dia), '[]')
        from (select dia, sum(valor) v from vd group by 1) x),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object(
                'mes', to_char(m, 'YYYY-MM'),
                'meta', painel_painelcliente_mes(v_pid, m::date)->'meta',
                'realizado', painel_painelcliente_mes(v_pid, m::date)->'realizado') order by m), '[]')
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
       -- "meta não é necessária" no cadastro: fica fora do card, a não ser que a meta more em outro lugar
       -- (Painel de controle do projeto ou Indicadores), caso do Vitor Jaci
       and (coalesce(c.goal_not_required, false) = false
            or painel_projeto_com_meta(c.id) is not null
            or exists (select 1 from facunicamps_matriculas fm where fm.company_id = c.id))
       and exists (select 1 from onboarding_projects p where p.onboarding_company_id = c.id
                     and p.status in ('active','notice_period','cancellation_signaled'))
  ), base as (
    select e.*, painel_kpi_principal(e.id) kid,
           exists (select 1 from facunicamps_matriculas fm where fm.company_id = e.id) indicadores,
           painel_projeto_com_meta(e.id) pid_painel
      from emp e
  ), calc as (
    select b.*,
           case when b.indicadores then 'Matrículas (Indicadores)' when b.pid_painel is not null then 'Vendas (Painel de controle)' else k.name end kpi,
           case when b.indicadores then 'numeric' when b.pid_painel is not null then 'monetary' else k.kpi_type end tipo,
           s.name consultor,
           x.meta, x.realizado, x.lanc_mes, x.ultimo
      from base b
      left join company_kpis k on k.id = b.kid
      left join onboarding_staff s on s.id = b.consultant_id
      cross join lateral (
        select (j->>'meta')::numeric meta, (j->>'realizado')::numeric realizado, (j->>'n')::int lanc_mes, (j->>'ultimo')::date ultimo
          from (select case
                  when b.indicadores then (select f || jsonb_build_object('n', f->'realizado') from painel_facunicamps_mes(b.id, v_ini) f)
                  when b.pid_painel is not null then painel_painelcliente_mes(b.pid_painel, v_ini)
                  else jsonb_build_object(
                    'meta', painel_kpi_meta_mes(b.kid, v_mes),
                    'realizado', (select sum(en.value) from kpi_entries en where en.kpi_id = b.kid and en.entry_date >= v_ini and en.entry_date < v_fim),
                    'n', (select count(*) from kpi_entries en where en.kpi_id = b.kid and en.entry_date >= v_ini and en.entry_date < v_fim),
                    'ultimo', (select max(en.entry_date) from kpi_entries en where en.kpi_id = b.kid and en.entry_date < v_fim))
                end j) q
      ) x
  ), fim as (
    select c.*,
           case when c.meta > 0 and c.lanc_mes > 0 then round(coalesce(c.realizado,0) / c.meta, 4) end pct,
           case when c.ultimo is not null and hoje < v_fim then hoje - c.ultimo end dias_sem_lancar,
           case
             when c.kid is null and not c.indicadores and c.pid_painel is null then 'sem_kpi'
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
                              and coalesce(c.is_simulator,false) = false and c.goal_not_required
                              and painel_projeto_com_meta(c.id) is null
                              and not exists (select 1 from facunicamps_matriculas fm where fm.company_id = c.id)),
    'clientes', coalesce(jsonb_agg(jsonb_build_object(
        'company_id', f.id, 'empresa', f.name, 'project_id', f.project_id, 'em_aviso', f.em_aviso,
        'consultant_id', f.consultant_id, 'consultor', f.consultor,
        'kpi_id', f.kid, 'kpi', f.kpi, 'tipo', f.tipo, 'fonte', case when f.indicadores then 'indicadores' when f.pid_painel is not null then 'painel' else 'kpis' end,
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
  -- Meta no "Painel de controle" do projeto (Vitor Jaci): meta e vendas vêm de lá (15/10/2026)
  if painel_projeto_com_meta(p_company) is not null then
    return painel_resultado_painelcliente_interno(p_month, p_company);
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

revoke all on function public.painel_projeto_com_meta(uuid) from public, anon, authenticated;
revoke all on function public.painel_painelcliente_mes(uuid, date) from public, anon, authenticated;
revoke all on function public.painel_resultado_painelcliente_interno(date, uuid) from public, anon, authenticated;
