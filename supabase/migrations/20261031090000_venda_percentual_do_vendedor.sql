-- A comissao de venda saia do percentual padrao, nao do percentual de quem
-- vendeu. O Taynon esta configurado com 5% de venda, mas o CRM da Simas pagava
-- R$29,60 (7,4% do padrao) em vez de R$20,00. Agora o percentual vem da regra
-- de quem vendeu, caindo no padrao so quando essa pessoa nao tem regra propria.

drop function if exists public.carteira_consultores_raw();

create or replace function public.carteira_consultores_raw()
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
  nao_pago_cents bigint,
  venda_primeiro_mes boolean,
  atraso_pago_cents bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dias   int;
  v_pct_venda numeric;
  v_pct_venda_unica numeric;
  v_sem_venda text[];
begin
  v_dias := extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day'))::int;

  select cfg.percentual_venda, cfg.percentual_venda_unica, cfg.produtos_sem_venda
    into v_pct_venda, v_pct_venda_unica, v_sem_venda
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
           coalesce(p.contract_start_date, p.created_at::date) as inicio,
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
  -- O que o cliente VENCEU e nao pagou no mes. Duas coisas de proposito aqui:
  -- fatura quitada e fatura quitada (o desconto de pix que a UNV da nao e calote
  -- do cliente), e fatura dentro do prazo nao e inadimplencia, entao so conta
  -- depois que passa o vencimento.
  pag as (
    select i.company_id as cid,
           -- vencido no mes e ainda sem pagar: sai da base deste mes
           sum(case when i.paid_at is null
                     and i.due_date >= date_trunc('month', current_date)
                     and i.due_date < current_date
                    then i.amount_cents else 0 end)::bigint as aberto,
           -- atrasado de mes anterior que o cliente quitou agora: volta aqui,
           -- porque no mes do vencimento ja tinha saido da base
           sum(case when i.paid_at is not null
                     and i.due_date < date_trunc('month', current_date)
                     and i.paid_at >= date_trunc('month', current_date)
                    then i.amount_cents else 0 end)::bigint as recuperado
      from company_invoices i
     where i.due_date >= date_trunc('month', current_date) - interval '12 months'
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
           coalesce(pag.aberto, 0) as aberto,
           coalesce(pag.recuperado, 0) as recuperado
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
  ),
  -- O desconto e o valor em aberto, nao uma porcentagem do mes inteiro. Cliente
  -- que pagou 12 meses adiantado no cartao nao pode perder o mes todo porque
  -- uma parcela de pix do mes ficou em aberto.
  val2 as (
    select v.*,
           sum(v.mensal) over (partition by v.cid) as mensal_emp
      from val v
  ),
  val3 as (
    select v2.*,
           (case when v2.mensal_emp > 0
                 then 1.0
                      - least(v2.aberto, v2.mensal_emp)::numeric / v2.mensal_emp::numeric
                      + v2.recuperado::numeric / v2.mensal_emp::numeric
                 else 1.0 end) as fator
      from val2 v2
  )
  select va.sid,
         st.name,
         c.id,
         c.name,
         va.pid,
         va.prod,
         va.mensal,
         (case
           when va.mvc is not null then 'mensalidade do projeto'
           when va.np = 1 and va.rt is not null then 'mensalidade cobrada'
           when va.pcv is not null and va.meses is not null and va.meses > 1 then 'contrato do projeto mensalizado'
           when va.pcv is not null then 'contrato do projeto'
           when va.ecv is not null and va.meses_emp is not null and va.meses_emp > 1 then 'contrato da empresa mensalizado'
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
         va.dias_ok,
         v_dias,
         round(va.mensal * coalesce(cp.pct, 0) / 100.0 * va.dias_ok / v_dias * va.fator)::bigint,
         round(va.mensal * coalesce(cp.pct, 0) / 100.0)::bigint,
         -- prazo de fim do contrato olhando todo mundo, mensal inclusive, pra
         -- nao perder renovacao por causa da periodicidade
         (coalesce(va.pfim, va.efim) - current_date)::int,
         vd.id,
         vd.name,
         -- comissao de venda: so com vendedor ativo e produto que gera venda
         -- Produto fora da comissao recorrente (UNV Social) paga uma vez so, no
         -- mes em que o contrato comecou. Os outros pagam todo mes.
         case
           when vd.id is null then null
           when not (va.prod = any (coalesce(v_sem_venda, array[]::text[])))
             then round(va.mensal * coalesce(cv.percentual_venda, v_pct_venda, 0) / 100.0 * va.dias_ok / v_dias * va.fator)::bigint
           when va.inicio is not null
                and date_trunc('month', va.inicio) = date_trunc('month', current_date)
             then round(va.mensal * coalesce(cv.percentual_venda_unica, v_pct_venda_unica, 0) / 100.0 * va.dias_ok / v_dias * va.fator)::bigint
         end,
         round(va.fator, 4),
         round(va.mensal * least(va.aberto, va.mensal_emp)::numeric / nullif(va.mensal_emp, 0))::bigint,
         (vd.id is not null
            and va.prod = any (coalesce(v_sem_venda, array[]::text[]))
            and va.inicio is not null
            and date_trunc('month', va.inicio) = date_trunc('month', current_date)),
         round(va.mensal * va.recuperado::numeric / nullif(va.mensal_emp, 0))::bigint
    from val3 va
    join onboarding_companies c on c.id = va.cid
    join onboarding_staff st on st.id = va.sid
    left join onboarding_staff vd on vd.id = va.vid and vd.is_active
    left join consultant_commission_config cc on cc.consultant_id = va.sid
    -- a comissao de venda sai do percentual de quem VENDEU, nao do padrao nem
    -- do percentual de quem entrega
    left join consultant_commission_config cv on cv.consultant_id = vd.id
    cross join lateral (
      select coalesce(cc.percentual, (select cfg_padrao.pct from cfg_padrao)) as pct
    ) cp
   where coalesce(c.is_simulator, false) = false
   order by 7 desc;
end
$$;






