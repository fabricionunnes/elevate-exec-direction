-- Carteira dos consultores: valor mensal de cada empresa, com o contrato anual
-- ja dividido por 12. Consultor enxerga so a propria carteira; master e admin
-- enxergam todas e podem filtrar por consultor.

alter table onboarding_projects add column if not exists monthly_value_cents integer;

comment on column onboarding_projects.monthly_value_cents is
  'Valor mensal do projeto em centavos. Preencher quando a empresa tem mais de um projeto e a mensalidade precisa ser dividida entre consultores (ex.: Duarte = Sales Acceleration + UNV Ads). Nulo = a carteira calcula pelo contrato ou pelas cobrancas recorrentes.';

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
  contrato_vencido boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid;
  v_role text;
  v_filter uuid;
begin
  select s.id, s.role into v_staff, v_role
    from onboarding_staff s
   where s.user_id = auth.uid() and s.is_active
   limit 1;

  if v_staff is null then
    return;
  end if;

  -- master e admin veem tudo e podem filtrar; os demais so a propria carteira
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
           p.product_name,
           p.status,
           p.monthly_value_cents,
           p.contract_value as pcv,
           p.contract_start_date as pini,
           p.contract_end_date as pfim,
           count(*) over (partition by p.onboarding_company_id) as projetos_da_empresa
      from onboarding_projects p
     where p.tenant_id is null
       and p.consultant_id is not null
       and p.status in ('active', 'cancellation_signaled', 'notice_period')
  ),
  -- O que a empresa realmente e cobrada no ciclo: soma das faturas da proxima
  -- competencia e, na falta dela, da competencia corrente. Usar as cobrancas
  -- recorrentes ativas inflaria o numero, porque sobraram cadastros duplicados
  -- e parados que nao geram fatura nenhuma.
  fat as (
    select i.company_id,
           to_char(i.due_date, 'YYYY-MM') as comp,
           sum(i.amount_cents)::bigint as total
      from company_invoices i
     where i.due_date >= date_trunc('month', current_date)
       and i.due_date < date_trunc('month', current_date) + interval '2 months'
     group by i.company_id, to_char(i.due_date, 'YYYY-MM')
  ),
  rec as (
    select f.company_id,
           (array_agg(f.total order by f.comp desc))[1] as total
      from fat f
     group by f.company_id
  ),
  com as (
    select r.company_id, coalesce(max(t.payout_cents), 0)::bigint as teto
      from company_commission_rules r
      left join company_commission_tiers t on t.rule_id = r.id
     where r.is_active
     group by r.company_id
  ),
  calc as (
    select pr.sid,
           pr.pid,
           pr.cid,
           pr.product_name,
           pr.status,
           pr.pcv,
           pr.pini,
           pr.pfim,
           case
             when pr.pini is not null and pr.pfim is not null
               then greatest(round((pr.pfim - pr.pini) / 30.0)::int, 1)
           end as meses,
           pr.monthly_value_cents,
           pr.projetos_da_empresa,
           rec.total as rec_total,
           coalesce(com.teto, 0) as teto
           ,ec.contract_value as ecv,
           ec.contract_end_date as efim,
           case
             when ec.contract_start_date is not null and ec.contract_end_date is not null
               then greatest(round((ec.contract_end_date - ec.contract_start_date) / 30.0)::int, 1)
           end as meses_empresa
      from proj pr
      left join rec on rec.company_id = pr.cid
      left join com on com.company_id = pr.cid
      join onboarding_companies ec on ec.id = pr.cid
  )
  select ca.sid,
         st.name,
         c.id,
         c.name,
         ca.pid,
         ca.product_name,
         case
           when ca.monthly_value_cents is not null then ca.monthly_value_cents::bigint
           when ca.projetos_da_empresa = 1 and ca.rec_total is not null then ca.rec_total
           when ca.pcv is not null and ca.meses is not null and ca.meses > 1
             then round(ca.pcv * 100 / ca.meses)::bigint
           when ca.projetos_da_empresa = 1 and ca.rec_total is not null then ca.rec_total
           when ca.pcv is not null then round(ca.pcv * 100)::bigint
           when ca.ecv is not null and ca.meses_empresa is not null and ca.meses_empresa > 1
             then round(ca.ecv * 100 / ca.meses_empresa)::bigint
           when ca.ecv is not null then round(ca.ecv * 100)::bigint
           else 0::bigint
         end as monthly_cents,
         case
           when ca.monthly_value_cents is not null then 'definido na mao'
           when ca.projetos_da_empresa = 1 and ca.rec_total is not null then 'faturado no mes'
           when ca.pcv is not null and ca.meses is not null and ca.meses > 1 then 'contrato dividido pelos meses'
           when ca.projetos_da_empresa = 1 and ca.rec_total is not null then 'faturado no mes'
           when ca.pcv is not null then 'contrato do projeto'
           when ca.ecv is not null and ca.meses_empresa is not null and ca.meses_empresa > 1
             then 'contrato da empresa dividido pelos meses'
           when ca.ecv is not null then 'contrato da empresa'
           else 'a definir'
         end as origem,
         ca.pcv,
         ca.pini,
         ca.pfim,
         ca.meses,
         ca.teto,
         ca.status
    from calc ca
    join onboarding_companies c on c.id = ca.cid
    join onboarding_staff st on st.id = ca.sid
   where coalesce(c.is_simulator, false) = false
     and (v_filter is null or ca.sid = v_filter)
   order by monthly_cents desc;
end
$$;

revoke all on function public.carteira_consultores(uuid) from public;
grant execute on function public.carteira_consultores(uuid) to authenticated;
