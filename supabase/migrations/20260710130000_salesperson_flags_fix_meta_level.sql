-- FIX: a meta do vendedor tem NÍVEIS (ex.: Bronze/Prata/Meta/Diamante) e a RPC
-- somava TODOS os níveis como se fossem uma meta só — inflava a meta ~4x e
-- rebaixava a flag (Marianna: meta real 70k, somada 266k → 29% "red" quando na
-- verdade 110% green). Agora usa SÓ o nível principal por vendedor×KPI: o nível
-- chamado 'Meta' (convenção do dashboard) ou, na falta, o de menor level_order.
create or replace function get_salesperson_flags(p_company_id uuid)
returns table(
  salesperson_id uuid, salesperson_name text, ref_month text, flag text,
  pct numeric, target_value numeric, achieved numeric, kpi_name text
)
language sql stable security definer set search_path = public as $$
  with months as (
    select
      to_char(date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - make_interval(months => n), 'YYYY-MM') as my,
      (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - make_interval(months => n))::date as m_start,
      (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - make_interval(months => n - 1))::date as m_end,
      n
    from generate_series(1, 3) n
  ),
  allowed as (
    select
      exists (select 1 from onboarding_staff st where st.user_id = auth.uid() and st.is_active)
      or exists (select 1 from company_salespeople cs where cs.user_id = auth.uid() and cs.company_id = p_company_id)
      or exists (select 1 from portal_users pu where pu.user_id = auth.uid() and pu.company_id = p_company_id)
      or coalesce((auth.jwt()->>'role') = 'service_role', false) as ok
  ),
  targets as (
    select distinct on (m.my, t.salesperson_id, t.kpi_id)
      m.my, t.salesperson_id sid, t.kpi_id, t.target_value target
    from kpi_monthly_targets t join months m on m.my = t.month_year
    where t.company_id = p_company_id and t.salesperson_id is not null and t.target_value > 0
    order by m.my, t.salesperson_id, t.kpi_id, (t.level_name = 'Meta') desc, t.level_order asc
  ),
  achieved as (
    select m.my, e.salesperson_id sid, e.kpi_id, sum(e.value) got
    from kpi_entries e join months m on e.entry_date >= m.m_start and e.entry_date < m.m_end
    where e.company_id = p_company_id and e.salesperson_id is not null
    group by 1, 2, 3
  ),
  per_kpi as (
    select t.my, t.sid, k.name kname, t.target, coalesce(a.got, 0) got,
      round(coalesce(a.got, 0) / nullif(t.target, 0) * 100, 1) pct,
      case when k.kpi_type = 'monetary' then 1
           when lower(k.name) ~ 'venda|fechamento' then 2 else 3 end prio
    from targets t
    join company_kpis k on k.id = t.kpi_id
    left join achieved a on a.sid = t.sid and a.kpi_id = t.kpi_id and a.my = t.my
  ),
  main_kpi as (
    select distinct on (my, sid) my, sid, kname, target, got, pct
    from per_kpi order by my, sid, prio, target desc
  )
  select s.id, s.name, m.my,
    case when mk.sid is null then 'none'
         when mk.pct < 70 then 'red'
         when mk.pct <= 100 then 'yellow'
         else 'green' end,
    mk.pct, mk.target, mk.got, mk.kname
  from company_salespeople s
  cross join months m
  left join main_kpi mk on mk.sid = s.id and mk.my = m.my, allowed
  where s.company_id = p_company_id and s.is_active = true and allowed.ok
  order by s.name, m.my desc;
$$;
grant execute on function get_salesperson_flags(uuid) to authenticated, service_role;
