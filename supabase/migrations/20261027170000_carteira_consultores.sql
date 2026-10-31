-- Carteira do consultor: quanto cada empresa representa por mes, com contrato
-- anual ou semestral ja dividido pelos meses. Consultor enxerga so a propria
-- carteira; master e admin enxergam todas e podem filtrar por consultor.

alter table onboarding_projects add column if not exists monthly_value_cents integer;

comment on column onboarding_projects.monthly_value_cents is
  'Valor mensal do projeto em centavos. Preencher quando a empresa tem mais de um projeto e a mensalidade precisa ser dividida entre consultores (ex.: Duarte = Sales Acceleration + UNV Ads). Nulo = a carteira calcula pelo contrato ou pelas faturas.';

drop function if exists public.carteira_consultores(uuid);

create or replace function public.carteira_consultores(p_consultant_id uuid default null)
returns table (
  consultant_id uuid,
  consultant_name text,
  company_id uuid,
  company_name text,
  project_id uuid,
  product_name text,
  monthly_cents bigint,
  origem text,
  contract_value numeric,
  contract_start_date date,
  contract_end_date date,
  contract_months int,
  commission_max_cents bigint,
  project_status text,
  contrato_vencido boolean,
  dias_para_vencer int,
  recorrente boolean,
  proxima_renovacao date,
  plano text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid;
  v_role  text;
  v_filter uuid;
begin
  select s.id, s.role into v_staff, v_role
    from onboarding_staff s
   where s.user_id = auth.uid() and s.is_active
   limit 1;

  if v_staff is null then
    return;
  end if;

  if v_role in ('master', 'admin') then
    v_filter := p_consultant_id;
  else
    v_filter := v_staff;
  end if;

  return query
  with proj as (
    select p.id as pid,
           p.onboarding_company_id as cid,
           p.consultant_id as sid,
           p.product_name as prod,
           p.status as st,
           p.monthly_value_cents as mvc,
           p.contract_value as pcv,
           p.contract_start_date as pini,
           p.contract_end_date as pfim,
           p.contract_term as termo,
           count(*) over (partition by p.onboarding_company_id) as np
      from onboarding_projects p
     where p.tenant_id is null
       and p.consultant_id is not null
       and p.status in ('active', 'cancellation_signaled', 'notice_period')
  ),
  -- O que a empresa e cobrada no ciclo. As cobrancas recorrentes ativas nao
  -- servem de base: sobraram cadastros duplicados e parados que nao geram
  -- fatura e inflavam a carteira em mais de 50%.
  fat as (
    select i.company_id as cid,
           to_char(i.due_date, 'YYYY-MM') as comp,
           sum(i.amount_cents)::bigint as total
      from company_invoices i
     where i.due_date >= date_trunc('month', current_date)
       and i.due_date < date_trunc('month', current_date) + interval '2 months'
     group by i.company_id, to_char(i.due_date, 'YYYY-MM')
  ),
  rec as (
    select f.cid, (array_agg(f.total order by f.comp desc))[1] as total
      from fat f group by f.cid
  ),
  com as (
    select r.company_id as cid, coalesce(max(t.payout_cents), 0)::bigint as teto
      from company_commission_rules r
      left join company_commission_tiers t on t.rule_id = r.id
     where r.is_active
     group by r.company_id
  ),
  calc as (
    select pr.*,
           rec.total as rt,
           coalesce(com.teto, 0) as teto,
           ec.contract_value as ecv,
           ec.contract_end_date as efim,
           lower(coalesce(pr.termo,
                          case ec.renewal_plan_type
                            when 'monthly' then 'mensal'
                            when 'annual' then 'anual'
                            when 'semiannual' then 'semestral'
                            when 'quarterly' then 'trimestral'
                            else ec.renewal_plan_type
                          end,
                          'mensal')) as plano,
           coalesce(ec.billing_day, extract(day from coalesce(pr.pini, ec.contract_start_date))::int) as dia_cob,
           case when pr.pini is not null and pr.pfim is not null
                then greatest(round((pr.pfim - pr.pini) / 30.0)::int, 1) end as meses,
           case when ec.contract_start_date is not null and ec.contract_end_date is not null
                then greatest(round((ec.contract_end_date - ec.contract_start_date) / 30.0)::int, 1) end as meses_emp
      from proj pr
      left join rec on rec.cid = pr.cid
      left join com on com.cid = pr.cid
      join onboarding_companies ec on ec.id = pr.cid
  )
  select ca.sid,
         st.name,
         c.id,
         c.name,
         ca.pid,
         ca.prod,
         (case
           when ca.mvc is not null then ca.mvc::bigint
           when ca.np = 1 and ca.rt is not null then ca.rt
           when ca.pcv is not null and ca.meses is not null and ca.meses > 1
             then round(ca.pcv * 100 / ca.meses)::bigint
           when ca.pcv is not null then round(ca.pcv * 100)::bigint
           when ca.ecv is not null and ca.meses_emp is not null and ca.meses_emp > 1
             then round(ca.ecv * 100 / ca.meses_emp)::bigint
           when ca.ecv is not null then round(ca.ecv * 100)::bigint
           else 0::bigint
         end)::bigint,
         (case
           when ca.mvc is not null then 'valor definido manualmente'
           when ca.np = 1 and ca.rt is not null then 'faturado no mês'
           when ca.pcv is not null and ca.meses is not null and ca.meses > 1 then 'contrato do projeto dividido pelos meses'
           when ca.pcv is not null then 'contrato do projeto'
           when ca.ecv is not null and ca.meses_emp is not null and ca.meses_emp > 1 then 'contrato da empresa dividido pelos meses'
           when ca.ecv is not null then 'contrato da empresa'
           else 'a definir'
         end)::text,
         ca.pcv,
         ca.pini,
         ca.pfim,
         ca.meses,
         ca.teto,
         ca.st::text,
         (coalesce(ca.plano, 'mensal') <> 'mensal'
            and coalesce(ca.pfim, ca.efim) is not null
            and coalesce(ca.pfim, ca.efim) < current_date),
         case when coalesce(ca.plano, 'mensal') <> 'mensal'
              then (coalesce(ca.pfim, ca.efim) - current_date)::int end,
         (coalesce(ca.plano, 'mensal') = 'mensal'),
         case when coalesce(ca.plano, 'mensal') = 'mensal' and ca.dia_cob is not null then
           (select min(d)::date from (
              select make_date(
                       extract(year from m)::int,
                       extract(month from m)::int,
                       least(ca.dia_cob, extract(day from (m + interval '1 month - 1 day'))::int)
                     ) as d
                from generate_series(date_trunc('month', current_date),
                                     date_trunc('month', current_date) + interval '1 month',
                                     interval '1 month') m
            ) x where x.d >= current_date)
         end,
         coalesce(ca.plano, 'mensal')::text
    from calc ca
    join onboarding_companies c on c.id = ca.cid
    join onboarding_staff st on st.id = ca.sid
   where coalesce(c.is_simulator, false) = false
     and (v_filter is null or ca.sid = v_filter)
   order by 7 desc;
end
$$;

revoke all on function public.carteira_consultores(uuid) from public;
grant execute on function public.carteira_consultores(uuid) to authenticated;


-- Historico mensal da carteira: faturado, recebido, comissao ganha e numero de
-- clientes mes a mes, respeitando a mesma regra de quem enxerga o que.
drop function if exists public.carteira_consultores_historico(uuid, int);

create or replace function public.carteira_consultores_historico(
  p_consultant_id uuid default null,
  p_meses int default 12
)
returns table (
  mes text,
  faturado_cents bigint,
  recebido_cents bigint,
  comissao_cents bigint,
  clientes int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid;
  v_role  text;
  v_filter uuid;
  v_ini date;
begin
  select s.id, s.role into v_staff, v_role
    from onboarding_staff s
   where s.user_id = auth.uid() and s.is_active
   limit 1;

  if v_staff is null then
    return;
  end if;

  if v_role in ('master', 'admin') then
    v_filter := p_consultant_id;
  else
    v_filter := v_staff;
  end if;

  v_ini := date_trunc('month', current_date) - make_interval(months => greatest(p_meses, 1) - 1);

  return query
  with empresas as (
    select distinct p.onboarding_company_id as cid
      from onboarding_projects p
     where p.tenant_id is null
       and p.consultant_id is not null
       and (v_filter is null or p.consultant_id = v_filter)
  ),
  meses as (
    select to_char(d, 'YYYY-MM') as m
      from generate_series(v_ini, date_trunc('month', current_date), interval '1 month') d
  ),
  inv as (
    select to_char(i.due_date, 'YYYY-MM') as m,
           sum(i.amount_cents)::bigint as faturado,
           sum(case when i.paid_at is not null
                    then coalesce(i.paid_amount_cents, i.amount_cents) else 0 end)::bigint as recebido,
           count(distinct i.company_id)::int as clientes
      from company_invoices i
      join empresas e on e.cid = i.company_id
     where i.due_date >= v_ini
     group by 1
  ),
  comi as (
    select run.month_year as m, sum(run.payout_cents)::bigint as comissao
      from company_commission_runs run
      join company_commission_rules r on r.id = run.rule_id
      join empresas e on e.cid = r.company_id
     where run.month_year >= to_char(v_ini, 'YYYY-MM')
     group by 1
  )
  select ms.m,
         coalesce(inv.faturado, 0),
         coalesce(inv.recebido, 0),
         coalesce(comi.comissao, 0),
         coalesce(inv.clientes, 0)
    from meses ms
    left join inv  on inv.m  = ms.m
    left join comi on comi.m = ms.m
   order by ms.m;
end
$$;

revoke all on function public.carteira_consultores_historico(uuid, int) from public;
grant execute on function public.carteira_consultores_historico(uuid, int) to authenticated;
