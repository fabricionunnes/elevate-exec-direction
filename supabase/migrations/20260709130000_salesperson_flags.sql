-- Flags de performance dos vendedores dos clientes (pedido Fabrício 2026-07-09):
-- calculadas sobre a META DO MÊS ANTERIOR — <70% = Red Flag · 70–100% = Yellow
-- Flag · >100% = Green Flag. Sem meta anterior = 'none'.
-- KPI de referência por vendedor: prioriza o monetário (faturamento), depois
-- KPIs de venda/fechamento, depois o de maior meta.
create or replace function get_salesperson_flags(p_company_id uuid)
returns table(
  salesperson_id uuid,
  salesperson_name text,
  flag text,
  pct numeric,
  target_value numeric,
  achieved numeric,
  kpi_name text,
  ref_month text
)
language sql
stable
security definer
set search_path = public
as $$
  with ref as (
    select
      to_char(date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 month', 'YYYY-MM') as my,
      (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 month')::date as m_start,
      date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date as m_end
  ),
  -- staff ativo, vendedor logado da empresa ou usuário do portal da empresa
  allowed as (
    select
      exists (select 1 from onboarding_staff st where st.user_id = auth.uid() and st.is_active)
      or exists (select 1 from company_salespeople cs where cs.user_id = auth.uid() and cs.company_id = p_company_id)
      or exists (select 1 from portal_users pu where pu.user_id = auth.uid() and pu.company_id = p_company_id) as ok
  ),
  targets as (
    select t.salesperson_id sid, t.kpi_id, sum(t.target_value) target
    from kpi_monthly_targets t, ref
    where t.company_id = p_company_id and t.month_year = ref.my
      and t.salesperson_id is not null and t.target_value > 0
    group by 1, 2
  ),
  achieved as (
    select e.salesperson_id sid, e.kpi_id, sum(e.value) got
    from kpi_entries e, ref
    where e.company_id = p_company_id and e.salesperson_id is not null
      and e.entry_date >= ref.m_start and e.entry_date < ref.m_end
    group by 1, 2
  ),
  per_kpi as (
    select t.sid, k.name kname, t.target, coalesce(a.got, 0) got,
      round(coalesce(a.got, 0) / nullif(t.target, 0) * 100, 1) pct,
      case when k.kpi_type = 'monetary' then 1
           when lower(k.name) ~ 'venda|fechamento' then 2
           else 3 end prio
    from targets t
    join company_kpis k on k.id = t.kpi_id
    left join achieved a on a.sid = t.sid and a.kpi_id = t.kpi_id
  ),
  main_kpi as (
    select distinct on (sid) sid, kname, target, got, pct
    from per_kpi order by sid, prio, target desc
  )
  select s.id, s.name,
    case when m.sid is null then 'none'
         when m.pct < 70 then 'red'
         when m.pct <= 100 then 'yellow'
         else 'green' end,
    m.pct, m.target, m.got, m.kname, (select my from ref)
  from company_salespeople s
  left join main_kpi m on m.sid = s.id, allowed
  where s.company_id = p_company_id and s.is_active = true and allowed.ok
  order by s.name;
$$;

grant execute on function get_salesperson_flags(uuid) to authenticated;
