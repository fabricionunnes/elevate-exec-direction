-- Base da comissao: valor mensalizado, zerado quando o cliente nao pagou.
--
-- "Cliente que nao paga nao gera comissao" vale pra INADIMPLENTE, nao pra quem
-- pagou adiantado. Cliente que quitou 12 meses no cartao nao tem fatura no mes,
-- e o consultor atende ele do mesmo jeito, entao conta cheio. Cliente com
-- fatura em aberto no mes entra proporcional ao que pagou.
--
-- Isso tambem resolve o rateio de empresa com dois consultores: a conta nunca
-- usa o valor recebido direto, usa o mensal de cada projeto vezes o fator de
-- pagamento da empresa. Na Duarte, Natallia leva 2/3 e Weslley 1/3 sozinho.

-- Comissao de venda do consultor.
--
-- Quem VENDE um servico pra um cliente ganha o mesmo percentual da carteira em
-- cima daquele projeto, enquanto o cliente ficar. Nao substitui a comissao de
-- quem ENTREGA: o consultor responsavel continua ganhando o dele no mesmo
-- projeto. Ou seja, um projeto vendido por A e entregue por B paga os dois.
--
-- Social media fica de fora da comissao de venda (a lista e editavel).
-- Consultor que sai da empresa para de ganhar: a comissao exige staff ativo.

alter table public.onboarding_projects
  add column if not exists sold_by_staff_id uuid references public.onboarding_staff(id) on delete set null;

comment on column public.onboarding_projects.sold_by_staff_id is
  'Quem vendeu este projeto. Preenchido na tela do projeto. Gera comissao de venda pra essa pessoa enquanto o cliente pagar e ela estiver ativa na equipe.';

create index if not exists onboarding_projects_sold_by_idx
  on public.onboarding_projects (sold_by_staff_id) where sold_by_staff_id is not null;

alter table public.consultant_commission_config
  add column if not exists percentual_venda numeric(6,3) not null default 7.4,
  add column if not exists produtos_sem_venda text[] not null default array['UNV Social']::text[];

comment on column public.consultant_commission_config.percentual_venda is
  'Percentual pago a quem vendeu o projeto, sobre o valor mensal.';
comment on column public.consultant_commission_config.produtos_sem_venda is
  'Produtos que nao geram comissao de venda (comparado com onboarding_projects.product_name).';


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
  plano text,
  saindo boolean,
  retido boolean,
  cancelamento_solicitado date,
  dias_comissionados int,
  dias_do_mes int,
  comissao_cents bigint,
  comissao_cheia_cents bigint,
  vence_em_dias int,
  vendido_por uuid,
  vendido_por_nome text,
  comissao_venda_cents bigint,
  fator_pago numeric,
  nao_pago_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff  uuid;
  v_role   text;
  v_filter uuid;
  v_master boolean;
  v_dias   int;
  v_pct_venda numeric;
  v_sem_venda text[];
begin
  select s.id, s.role into v_staff, v_role
    from onboarding_staff s
   where s.user_id = auth.uid() and s.is_active
   limit 1;

  if v_staff is null then
    return;
  end if;

  v_master := (v_role = 'master');

  if v_role in ('master', 'admin') then
    v_filter := p_consultant_id;
  else
    v_filter := v_staff;
  end if;

  v_dias := extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day'))::int;

  select cfg.percentual_venda, cfg.produtos_sem_venda
    into v_pct_venda, v_sem_venda
    from consultant_commission_config cfg
   where cfg.consultant_id is null
   limit 1;

  return query
  with cfg_padrao as (
    select cfg.piso_cents as piso, cfg.percentual as pct, cfg.teto_cents as teto
      from consultant_commission_config cfg where cfg.consultant_id is null limit 1
  ),
  proj as (
    select p.id as pid,
           p.onboarding_company_id as cid,
           p.consultant_id as sid,
           p.sold_by_staff_id as vid,
           p.product_name as prod,
           p.status as st,
           p.monthly_value_cents as mvc,
           p.contract_value as pcv,
           p.contract_start_date as pini,
           p.contract_end_date as pfim,
           p.contract_term as termo,
           coalesce(p.cancellation_signal_date, p.churn_date)::date as sinal,
           p.reactivated_at::date as reat,
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
  pag as (
    select i.company_id as cid,
           sum(i.amount_cents)::bigint as fat,
           sum(case when i.paid_at is not null
                    then coalesce(i.paid_amount_cents, i.amount_cents) else 0 end)::bigint as rec
      from company_invoices i
     where i.due_date >= date_trunc('month', current_date)
       and i.due_date < date_trunc('month', current_date) + interval '1 month'
     group by i.company_id
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
                then greatest(round((ec.contract_end_date - ec.contract_start_date) / 30.0)::int, 1) end as meses_emp,
           -- pediu pra sair e nao foi retido: reativacao depois do pedido anula o pedido
           (pr.reat is not null and pr.sinal is not null and pr.reat >= pr.sinal) as e_retido,
           ((pr.sinal is not null or pr.st in ('cancellation_signaled', 'notice_period'))
             and not (pr.reat is not null and pr.sinal is not null and pr.reat >= pr.sinal)) as e_saindo
           ,
           -- sem fatura no mes = pagou adiantado, conta cheio
           (case when coalesce(pag.fat, 0) = 0 then 1.0
                 else least(coalesce(pag.rec, 0)::numeric / pag.fat::numeric, 1.0) end) as fator
      from proj pr
      left join rec on rec.cid = pr.cid
      left join com on com.cid = pr.cid
      left join pag on pag.cid = pr.cid
      join onboarding_companies ec on ec.id = pr.cid
  ),
  val as (
    select ca.*,
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
           end)::bigint as mensal,
           -- dias que contam pra comissao: quem esta saindo para na data do pedido
           (case
             when not ca.e_saindo then v_dias
             when ca.sinal is null then v_dias
             when ca.sinal < date_trunc('month', current_date)::date then 0
             else extract(day from ca.sinal)::int
           end) as dias_ok
      from calc ca
  )
  select va.sid,
         st.name,
         c.id,
         c.name,
         va.pid,
         va.prod,
         va.mensal,
         (case
           when va.mvc is not null then 'valor definido manualmente'
           when va.np = 1 and va.rt is not null then 'faturado no mês'
           when va.pcv is not null and va.meses is not null and va.meses > 1 then 'contrato do projeto dividido pelos meses'
           when va.pcv is not null then 'contrato do projeto'
           when va.ecv is not null and va.meses_emp is not null and va.meses_emp > 1 then 'contrato da empresa dividido pelos meses'
           when va.ecv is not null then 'contrato da empresa'
           else 'a definir'
         end)::text,
         va.pcv,
         va.pini,
         va.pfim,
         va.meses,
         va.teto,
         va.st::text,
         (coalesce(va.plano, 'mensal') <> 'mensal'
            and coalesce(va.pfim, va.efim) is not null
            and coalesce(va.pfim, va.efim) < current_date),
         case when coalesce(va.plano, 'mensal') <> 'mensal'
              then (coalesce(va.pfim, va.efim) - current_date)::int end,
         (coalesce(va.plano, 'mensal') = 'mensal'),
         case when coalesce(va.plano, 'mensal') = 'mensal' and va.dia_cob is not null then
           (select min(d)::date from (
              select make_date(
                       extract(year from m)::int,
                       extract(month from m)::int,
                       least(va.dia_cob, extract(day from (m + interval '1 month - 1 day'))::int)
                     ) as d
                from generate_series(date_trunc('month', current_date),
                                     date_trunc('month', current_date) + interval '1 month',
                                     interval '1 month') m
            ) x where x.d >= current_date)
         end,
         coalesce(va.plano, 'mensal')::text,
         va.e_saindo,
         va.e_retido,
         va.sinal,
         case when v_master then va.dias_ok end,
         case when v_master then v_dias end,
         case when v_master
              then round(va.mensal * coalesce(cp.pct, 0) / 100.0 * va.dias_ok / v_dias * va.fator)::bigint end,
         case when v_master
              then round(va.mensal * coalesce(cp.pct, 0) / 100.0)::bigint end,
         -- prazo de fim do contrato olhando todo mundo, mensal inclusive, pra
         -- nao perder renovacao por causa da periodicidade
         (coalesce(va.pfim, va.efim) - current_date)::int,
         vd.id,
         vd.name,
         -- comissao de venda: so com vendedor ativo e produto que gera venda
         case when v_master and vd.id is not null
                   and not (va.prod = any (coalesce(v_sem_venda, array[]::text[])))
              then round(va.mensal * coalesce(v_pct_venda, 0) / 100.0 * va.dias_ok / v_dias * va.fator)::bigint end,
         round(va.fator, 4),
         round(va.mensal * (1 - va.fator))::bigint
    from val va
    join onboarding_companies c on c.id = va.cid
    join onboarding_staff st on st.id = va.sid
    left join onboarding_staff vd on vd.id = va.vid and vd.is_active
    left join consultant_commission_config cc on cc.consultant_id = va.sid
    cross join lateral (
      select coalesce(cc.percentual, (select cfg_padrao.pct from cfg_padrao)) as pct
    ) cp
   where coalesce(c.is_simulator, false) = false
     and (v_filter is null or va.sid = v_filter)
   order by 7 desc;
end
$$;

revoke all on function public.carteira_consultores(uuid) from public;
grant execute on function public.carteira_consultores(uuid) to authenticated;


-- Resumo por pessoa: o que ela ganha entregando mais o que ganha tendo vendido.
-- So o master enxerga. Le a carteira inteira e filtra no fim, senao quem so
-- vendeu (e nao entrega) sumiria do resultado.
drop function if exists public.carteira_comissao_resumo(uuid);

create or replace function public.carteira_comissao_resumo(p_consultant_id uuid default null)
returns table (
  consultant_id uuid,
  consultant_name text,
  papel text,
  contratos int,
  clientes int,
  saindo int,
  carteira_cents bigint,
  base_cents bigint,
  nao_pago_cents bigint,
  piso_cents int,
  percentual numeric,
  teto_cents int,
  variavel_cents bigint,
  variavel_cheia_cents bigint,
  perdido_cents bigint,
  vendas int,
  carteira_vendida_cents bigint,
  venda_cents bigint,
  total_cents bigint,
  acima_teto boolean,
  peso numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select s.role into v_role
    from onboarding_staff s
   where s.user_id = auth.uid() and s.is_active
   limit 1;

  if v_role is distinct from 'master' then
    return;
  end if;

  return query
  with padrao as (
    select cfg.piso_cents as piso, cfg.percentual as pct, cfg.teto_cents as teto
      from consultant_commission_config cfg where cfg.consultant_id is null limit 1
  ),
  base as (
    select * from carteira_consultores(null)
  ),
  entrega as (
    select b.consultant_id as sid,
           count(*)::int as qt,
           count(distinct b.company_id)::int as cli,
           count(*) filter (where b.saindo)::int as sai,
           coalesce(sum(b.monthly_cents), 0)::bigint as cart,
           coalesce(sum(b.monthly_cents * b.fator_pago), 0)::bigint as base,
           coalesce(sum(b.nao_pago_cents), 0)::bigint as npago,
           coalesce(sum(b.comissao_cents), 0)::bigint as com,
           coalesce(sum(b.comissao_cheia_cents), 0)::bigint as cheia
      from base b
     group by b.consultant_id
  ),
  venda as (
    select b.vendido_por as sid,
           count(*)::int as qt,
           coalesce(sum(b.monthly_cents), 0)::bigint as cart,
           coalesce(sum(b.comissao_venda_cents), 0)::bigint as com
      from base b
     where b.vendido_por is not null and b.comissao_venda_cents is not null
     group by b.vendido_por
  ),
  pessoas as (
    select sid from entrega
    union
    select sid from venda
  )
  select p.sid,
         stf.name::text,
         stf.role::text,
         coalesce(e.qt, 0),
         coalesce(e.cli, 0),
         coalesce(e.sai, 0),
         coalesce(e.cart, 0)::bigint,
         coalesce(e.base, 0)::bigint,
         coalesce(e.npago, 0)::bigint,
         -- piso so pra quem carrega carteira; quem so vendeu ganha o variavel
         (case when coalesce(e.qt, 0) > 0 then coalesce(cc.piso_cents, pa.piso) else 0 end)::int,
         coalesce(cc.percentual, pa.pct),
         coalesce(cc.teto_cents, pa.teto)::int,
         coalesce(e.com, 0)::bigint,
         coalesce(e.cheia, 0)::bigint,
         (coalesce(e.cheia, 0) - coalesce(e.com, 0))::bigint,
         coalesce(v.qt, 0),
         coalesce(v.cart, 0)::bigint,
         coalesce(v.com, 0)::bigint,
         ((case when coalesce(e.qt, 0) > 0 then coalesce(cc.piso_cents, pa.piso) else 0 end)
           + coalesce(e.com, 0) + coalesce(v.com, 0))::bigint,
         (coalesce(cc.teto_cents, pa.teto) is not null
           and (case when coalesce(e.qt, 0) > 0 then coalesce(cc.piso_cents, pa.piso) else 0 end)
               + coalesce(e.com, 0) + coalesce(v.com, 0) > coalesce(cc.teto_cents, pa.teto)),
         case when coalesce(e.cart, 0) + coalesce(v.cart, 0) > 0
              then round(((case when coalesce(e.qt, 0) > 0 then coalesce(cc.piso_cents, pa.piso) else 0 end)
                           + coalesce(e.com, 0) + coalesce(v.com, 0))::numeric
                         / (coalesce(e.cart, 0) + coalesce(v.cart, 0))::numeric, 4) end
    from pessoas p
    join onboarding_staff stf on stf.id = p.sid
    cross join padrao pa
    left join entrega e on e.sid = p.sid
    left join venda   v on v.sid = p.sid
    left join consultant_commission_config cc on cc.consultant_id = p.sid
   where (p_consultant_id is null or p.sid = p_consultant_id)
   order by 19 desc;
end
$$;

revoke all on function public.carteira_comissao_resumo(uuid) from public;
grant execute on function public.carteira_comissao_resumo(uuid) to authenticated;
