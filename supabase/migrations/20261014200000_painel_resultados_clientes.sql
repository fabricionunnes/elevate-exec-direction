-- Painel de Controle: resultados dos clientes (14/10/2026, pedido do Fabrício:
-- "card pra falar dos resultados dos clientes, por percentual de meta entregue, com
-- alerta pra quem está sem meta e sem resultado lançado, tudo clicável pra visão micro").
--
-- Régua = a mesma da aba KPIs do projeto do cliente (KPIDashboardTab, visão da empresa):
--   KPI do cliente  = o marcado como meta principal (company_kpis.is_main_goal); sem marcação,
--                     o primeiro monetário ativo.
--   meta do mês     = soma das metas por vendedor (nível 1, "Meta") > meta da empresa >
--                     soma das metas por unidade > soma das metas por time > meta padrão do KPI.
--   realizado       = soma de kpi_entries do KPI no mês.
--   ritmo           = dias úteis (seg a sex) já passados, sem contar hoje, sobre os do mês.

-- Meta de um KPI num mês ('YYYY-MM'), nível 1. Null = sem meta.
create or replace function public.painel_kpi_meta_mes(p_kpi uuid, p_mes text)
 returns numeric language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(
    (select nullif(sum(t.target_value), 0) from kpi_monthly_targets t
      where t.kpi_id = p_kpi and t.month_year = p_mes and t.level_order = 1 and t.salesperson_id is not null),
    (select nullif(sum(t.target_value), 0) from kpi_monthly_targets t
      where t.kpi_id = p_kpi and t.month_year = p_mes and t.level_order = 1
        and t.salesperson_id is null and t.team_id is null and t.unit_id is null),
    (select nullif(sum(t.target_value), 0) from kpi_monthly_targets t
      where t.kpi_id = p_kpi and t.month_year = p_mes and t.level_order = 1
        and t.salesperson_id is null and t.team_id is null and t.unit_id is not null),
    (select nullif(sum(t.target_value), 0) from kpi_monthly_targets t
      where t.kpi_id = p_kpi and t.month_year = p_mes and t.level_order = 1
        and t.salesperson_id is null and t.team_id is not null),
    (select nullif(k.target_value, 0) from company_kpis k where k.id = p_kpi)
  );
$function$;

-- KPI principal de uma empresa
create or replace function public.painel_kpi_principal(p_company uuid)
 returns uuid language sql stable security definer set search_path to 'public'
as $function$
  select k.id from company_kpis k
   where k.company_id = p_company and k.is_active
   order by k.is_main_goal desc nulls last, (k.kpi_type = 'monetary') desc, k.sort_order nulls last, k.created_at
   limit 1;
$function$;

-- Ritmo do mês: dias úteis do mês e quantos já passaram (até ontem)
create or replace function public.painel_ritmo_mes(p_month date)
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  with lim as (
    select date_trunc('month', p_month)::date ini,
           (date_trunc('month', p_month) + interval '1 month')::date fim,
           (now() at time zone 'America/Sao_Paulo')::date hoje
  ), dias as (
    select g::date d from lim, generate_series(lim.ini, lim.fim - 1, interval '1 day') g
     where extract(isodow from g) < 6
  )
  select jsonb_build_object(
    'dias_uteis', (select count(*) from dias),
    'dias_passados', (select count(*) from dias, lim where dias.d < least(lim.hoje, lim.fim)),
    'ritmo', case when (select hoje from lim) >= (select fim from lim) then 1
                  when (select hoje from lim) < (select ini from lim) then 0
                  else round((select count(*) from dias, lim where dias.d < lim.hoje)::numeric / nullif((select count(*) from dias), 0), 4) end,
    'fechado', (select hoje >= fim from lim)
  );
$function$;

-- Visão macro: um registro por cliente ativo
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
       and exists (select 1 from onboarding_projects p where p.onboarding_company_id = c.id
                     and p.status in ('active','notice_period','cancellation_signaled'))
  ), base as (
    select e.*, painel_kpi_principal(e.id) kid from emp e
  ), calc as (
    select b.*, k.name kpi, k.kpi_type tipo, s.name consultor,
           painel_kpi_meta_mes(b.kid, v_mes) meta,
           (select sum(en.value) from kpi_entries en where en.kpi_id = b.kid and en.entry_date >= v_ini and en.entry_date < v_fim) realizado,
           (select count(*) from kpi_entries en where en.kpi_id = b.kid and en.entry_date >= v_ini and en.entry_date < v_fim) lanc_mes,
           (select max(en.entry_date) from kpi_entries en where en.kpi_id = b.kid and en.entry_date < v_fim) ultimo
      from base b
      left join company_kpis k on k.id = b.kid
      left join onboarding_staff s on s.id = b.consultant_id
  ), fim as (
    select c.*,
           case when c.meta > 0 and c.lanc_mes > 0 then round(coalesce(c.realizado,0) / c.meta, 4) end pct,
           case when c.ultimo is not null and hoje < v_fim then hoje - c.ultimo end dias_sem_lancar,
           case
             when c.kid is null then 'sem_kpi'
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
    'clientes', coalesce(jsonb_agg(jsonb_build_object(
        'company_id', f.id, 'empresa', f.name, 'project_id', f.project_id, 'em_aviso', f.em_aviso,
        'consultant_id', f.consultant_id, 'consultor', f.consultor,
        'kpi_id', f.kid, 'kpi', f.kpi, 'tipo', f.tipo,
        'meta', f.meta, 'realizado', f.realizado, 'pct', f.pct,
        'lanc_mes', f.lanc_mes, 'ultimo', f.ultimo, 'dias_sem_lancar', f.dias_sem_lancar,
        'situacao', f.situacao)
      order by array_position(array['sem_nada','sem_resultado','sem_meta','sem_kpi','abaixo','atencao','no_ritmo','batida'], f.situacao), f.pct nulls first, f.name), '[]')
  ) into res
  from fim f;
  return res;
end $function$;

-- Visão micro: um cliente, todos os KPIs, vendedores do KPI principal, dia a dia e 6 meses
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

-- Portas de entrada (só o master)
create or replace function public.painel_resultado_cliente(p_month date, p_company uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not is_master() then raise exception 'Só o master'; end if;
  return painel_resultado_cliente_interno(p_month, p_company);
end $function$;

create or replace function public.painel_bloco(p_month date, p_nome text)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not is_master() then raise exception 'Só o master'; end if;
  case p_nome
    when 'receita' then return painel_receita_interno(p_month);
    when 'produtos' then return painel_produtos_interno(p_month);
    when 'resultados' then return painel_resultados_interno(p_month);
    else raise exception 'Bloco desconhecido: %', p_nome;
  end case;
end $function$;

revoke all on function public.painel_kpi_meta_mes(uuid, text) from public, anon, authenticated;
revoke all on function public.painel_kpi_principal(uuid) from public, anon, authenticated;
revoke all on function public.painel_ritmo_mes(date) from public, anon, authenticated;
revoke all on function public.painel_resultados_interno(date) from public, anon, authenticated;
revoke all on function public.painel_resultado_cliente_interno(date, uuid) from public, anon, authenticated;
revoke all on function public.painel_resultado_cliente(date, uuid) from public, anon;
grant execute on function public.painel_resultado_cliente(date, uuid) to authenticated;
