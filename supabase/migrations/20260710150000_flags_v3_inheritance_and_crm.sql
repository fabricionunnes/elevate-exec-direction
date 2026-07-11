-- Flags v3 (clientes): quando o vendedor NÃO tem meta individual, herda a meta
-- da empresa (mensal registrada ou padrão do KPI) dividida pelos vendedores
-- ativos — as flags passam a aparecer em TODAS as empresas com meta. Campo
-- inherited=true marca meta rateada. KPIs com "meta" no nome são excluídos do
-- cálculo (ex.: "Meta Faturamento" da Vidroflex, que é meta lançada como
-- indicador — não é produção).
drop function if exists get_salesperson_flags(uuid);
create or replace function get_salesperson_flags(p_company_id uuid)
returns table(
  salesperson_id uuid, salesperson_name text, ref_month text, flag text,
  pct numeric, target_value numeric, achieved numeric, kpi_name text, inherited boolean
)
language sql stable security definer set search_path = public as $$
  with months as (
    select
      to_char(date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - make_interval(months => n), 'YYYY-MM') as my,
      (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - make_interval(months => n))::date as m_start,
      (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - make_interval(months => n - 1))::date as m_end
    from generate_series(1, 3) n
  ),
  allowed as (
    select
      exists (select 1 from onboarding_staff st where st.user_id = auth.uid() and st.is_active)
      or exists (select 1 from company_salespeople cs where cs.user_id = auth.uid() and cs.company_id = p_company_id)
      or exists (select 1 from portal_users pu where pu.user_id = auth.uid() and pu.company_id = p_company_id)
      or coalesce((auth.jwt()->>'role') = 'service_role', false) as ok
  ),
  sellers as (select id from company_salespeople where company_id = p_company_id and is_active = true),
  n_sellers as (select greatest(count(*), 1) n from sellers),
  t_ind as (
    select distinct on (m.my, t.salesperson_id, t.kpi_id) m.my, t.salesperson_id sid, t.kpi_id, t.target_value target
    from kpi_monthly_targets t join months m on m.my = t.month_year
    where t.company_id = p_company_id and t.salesperson_id is not null and t.target_value > 0
    order by m.my, t.salesperson_id, t.kpi_id, (t.level_name = 'Meta') desc, t.level_order asc
  ),
  t_comp as (
    select distinct on (m.my, t.kpi_id) m.my, t.kpi_id, t.target_value target
    from kpi_monthly_targets t join months m on m.my = t.month_year
    where t.company_id = p_company_id and t.salesperson_id is null and t.team_id is null
      and t.unit_id is null and t.sector_id is null and t.target_value > 0
    order by m.my, t.kpi_id, (t.level_name = 'Meta') desc, t.level_order asc
  ),
  t_default as (
    select k.id kpi_id, k.target_value target
    from company_kpis k
    where k.company_id = p_company_id and k.is_active = true
      and coalesce(k.target_value, 0) > 0 and k.salesperson_id is null
  ),
  kpi_months as (
    select distinct k.kpi_id, m.my
    from months m
    cross join (select kpi_id from t_default union select kpi_id from t_ind union select kpi_id from t_comp) k
  ),
  t_final as (
    select s.id sid, km.my, km.kpi_id,
      coalesce(ti.target, tc.target / ns.n, td.target / ns.n) target,
      (ti.target is null) inherited
    from sellers s
    cross join n_sellers ns
    join kpi_months km on true
    left join t_ind ti on ti.sid = s.id and ti.kpi_id = km.kpi_id and ti.my = km.my
    left join t_comp tc on tc.kpi_id = km.kpi_id and tc.my = km.my
    left join t_default td on td.kpi_id = km.kpi_id
    where coalesce(ti.target, tc.target / ns.n, td.target / ns.n) > 0
  ),
  achieved as (
    select m.my, e.salesperson_id sid, e.kpi_id, sum(e.value) got
    from kpi_entries e join months m on e.entry_date >= m.m_start and e.entry_date < m.m_end
    where e.company_id = p_company_id and e.salesperson_id is not null
    group by 1, 2, 3
  ),
  per_kpi as (
    select t.my, t.sid, k.name kname, t.target, t.inherited, coalesce(a.got, 0) got,
      round(coalesce(a.got, 0) / nullif(t.target, 0) * 100, 1) pct,
      case when k.kpi_type = 'monetary' then 1
           when lower(k.name) ~ 'venda|fechamento' then 2 else 3 end prio
    from t_final t
    join company_kpis k on k.id = t.kpi_id
    left join achieved a on a.sid = t.sid and a.kpi_id = t.kpi_id and a.my = t.my
    where lower(k.name) not like '%meta%'
  ),
  main_kpi as (
    select distinct on (my, sid) my, sid, kname, target, got, pct, inherited
    from per_kpi order by my, sid, prio, target desc
  )
  select s.id, s.name, m.my,
    case when mk.sid is null then 'none'
         when mk.pct < 70 then 'red'
         when mk.pct <= 100 then 'yellow'
         else 'green' end,
    mk.pct, mk.target, mk.got, mk.kname, coalesce(mk.inherited, false)
  from company_salespeople s
  cross join months m
  left join main_kpi mk on mk.sid = s.id and mk.my = m.my, allowed
  where s.company_id = p_company_id and s.is_active = true and allowed.ok
  order by s.name, m.my desc;
$$;
grant execute on function get_salesperson_flags(uuid) to authenticated, service_role;

-- Flags do TIME COMERCIAL INTERNO (CRM): closers (role ou is_crm_closer),
-- head (meta dela vs vendas do time inteiro) e SDRs (agendamentos creditados),
-- 3 meses fechados, mesma régua.
create or replace function get_crm_staff_flags()
returns table(staff_id uuid, staff_name text, papel text, ref_month text, flag text,
              pct numeric, target_value numeric, achieved numeric, metric text)
language sql stable security definer set search_path = public as $$
  with months as (
    select
      to_char(date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - make_interval(months => n), 'YYYY-MM') as my,
      (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - make_interval(months => n))::date as m_start,
      (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - make_interval(months => n - 1))::date as m_end
    from generate_series(1, 3) n
  ),
  allowed as (
    select exists (select 1 from onboarding_staff st where st.user_id = auth.uid() and st.is_active)
      or coalesce((auth.jwt()->>'role') = 'service_role', false) as ok
  ),
  people as (
    select id, name,
      case when role = 'sdr' then 'sdr' when role = 'head_comercial' then 'head' else 'closer' end papel
    from onboarding_staff
    where is_active = true and tenant_id is null
      and (role in ('closer','sdr','head_comercial') or is_crm_closer = true)
  ),
  goals as (
    select gv.staff_id sid, m.my, gv.meta_value
    from crm_goal_values gv
    join crm_goal_types gt on gt.id = gv.goal_type_id
    join months m on gv.month = extract(month from m.m_start)::int and gv.year = extract(year from m.m_start)::int
    where gv.meta_value > 0 and gt.name in ('Vendas','Agendamentos')
  ),
  won as (
    select coalesce(l.closer_staff_id, l.owner_staff_id) sid, m.my, sum(coalesce(l.opportunity_value, 0)) val
    from crm_leads l
    join crm_stages st on st.id = l.stage_id
    join months m on (coalesce(l.closed_at, l.updated_at) at time zone 'America/Sao_Paulo') >= m.m_start
                 and (coalesce(l.closed_at, l.updated_at) at time zone 'America/Sao_Paulo') < m.m_end
    where st.final_type = 'won' and coalesce(l.closer_staff_id, l.owner_staff_id) is not null
    group by 1, 2
  ),
  team_won as (select my, sum(val) val from won group by 1),
  sched as (
    select e.credited_staff_id sid, m.my, count(*)::numeric n
    from crm_meeting_events e
    join months m on e.event_date >= m.m_start and e.event_date < m.m_end
    where e.event_type = 'scheduled' and e.credited_staff_id is not null
    group by 1, 2
  ),
  calc as (
    select p.id, p.name, p.papel, m.my, g.meta_value target,
      case p.papel when 'sdr' then coalesce(s.n, 0)
                   when 'head' then coalesce(tw.val, 0)
                   else coalesce(w.val, 0) end got,
      case p.papel when 'sdr' then 'agendamentos' else 'vendas' end metric
    from people p
    cross join months m
    left join goals g on g.sid = p.id and g.my = m.my
    left join won w on w.sid = p.id and w.my = m.my
    left join team_won tw on tw.my = m.my
    left join sched s on s.sid = p.id and s.my = m.my
  )
  select c.id, c.name, c.papel, c.my,
    case when c.target is null then 'none'
         when round(c.got / nullif(c.target, 0) * 100, 1) < 70 then 'red'
         when round(c.got / nullif(c.target, 0) * 100, 1) <= 100 then 'yellow'
         else 'green' end,
    round(c.got / nullif(c.target, 0) * 100, 1), c.target, c.got, c.metric
  from calc c, allowed
  where allowed.ok
  order by c.name, c.my desc;
$$;
grant execute on function get_crm_staff_flags() to authenticated, service_role;
