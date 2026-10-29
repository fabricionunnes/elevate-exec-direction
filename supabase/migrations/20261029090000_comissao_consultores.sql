-- Comissao do consultor dentro da Carteira. Por enquanto so o master enxerga:
-- as funcoes devolvem os valores em branco pra qualquer outro papel, entao nao
-- adianta o consultor chamar a RPC na mao.
--
-- Regra combinada: piso fixo + percentual da carteira mensalizada, com teto de
-- media por consultor. Quando o cliente pede pra sair, a comissao do mes e
-- proporcional ao DIA DA SOLICITACAO, nao ao dia em que o contrato encerra de
-- fato. Cliente que pediu e foi retido (reativado depois do pedido) volta a
-- valer cheio.

create table if not exists public.consultant_commission_config (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid references public.onboarding_staff(id) on delete cascade,
  piso_cents integer not null default 200000,
  percentual numeric(6,3) not null default 7.4,
  teto_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.consultant_commission_config is
  'Parametros da comissao do consultor. Linha com consultant_id nulo e a regra padrao; linha com consultant_id sobrescreve a padrao para aquele consultor.';

create unique index if not exists consultant_commission_config_padrao
  on public.consultant_commission_config ((consultant_id is null)) where consultant_id is null;

create unique index if not exists consultant_commission_config_consultor
  on public.consultant_commission_config (consultant_id) where consultant_id is not null;

insert into public.consultant_commission_config (consultant_id, piso_cents, percentual, teto_cents)
select null, 200000, 7.4, 350000
where not exists (select 1 from public.consultant_commission_config where consultant_id is null);

alter table public.consultant_commission_config enable row level security;

-- sem grant o PostgREST nao chega na tabela nem pro master; quem filtra e a RLS
grant select, insert, update, delete on public.consultant_commission_config to authenticated;

drop policy if exists ccc_master_all on public.consultant_commission_config;
create policy ccc_master_all on public.consultant_commission_config
  for all to authenticated
  using (exists (select 1 from public.onboarding_staff s
                  where s.user_id = auth.uid() and s.is_active and s.role = 'master'))
  with check (exists (select 1 from public.onboarding_staff s
                       where s.user_id = auth.uid() and s.is_active and s.role = 'master'));


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
  vence_em_dias int
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

  return query
  with cfg_padrao as (
    select cfg.piso_cents as piso, cfg.percentual as pct, cfg.teto_cents as teto
      from consultant_commission_config cfg where cfg.consultant_id is null limit 1
  ),
  proj as (
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
      from proj pr
      left join rec on rec.cid = pr.cid
      left join com on com.cid = pr.cid
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
              then round(va.mensal * coalesce(cp.pct, 0) / 100.0 * va.dias_ok / v_dias)::bigint end,
         case when v_master
              then round(va.mensal * coalesce(cp.pct, 0) / 100.0)::bigint end,
         -- prazo de fim do contrato olhando todo mundo, mensal inclusive, pra
         -- nao perder renovacao por causa da periodicidade
         (coalesce(va.pfim, va.efim) - current_date)::int
    from val va
    join onboarding_companies c on c.id = va.cid
    join onboarding_staff st on st.id = va.sid
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


-- Resumo da comissao por consultor. So o master enxerga; qualquer outro papel
-- recebe vazio. Reaproveita a carteira pra os dois numeros nunca divergirem.
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
  piso_cents int,
  percentual numeric,
  teto_cents int,
  variavel_cents bigint,
  variavel_cheia_cents bigint,
  perdido_cents bigint,
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
    select * from carteira_consultores(p_consultant_id)
  )
  select b.consultant_id,
         b.consultant_name,
         max(stf.role)::text,
         count(*)::int,
         count(distinct b.company_id)::int,
         count(*) filter (where b.saindo)::int,
         sum(b.monthly_cents)::bigint,
         coalesce(cc.piso_cents, pa.piso)::int,
         coalesce(cc.percentual, pa.pct),
         coalesce(cc.teto_cents, pa.teto)::int,
         coalesce(sum(b.comissao_cents), 0)::bigint,
         coalesce(sum(b.comissao_cheia_cents), 0)::bigint,
         (coalesce(sum(b.comissao_cheia_cents), 0) - coalesce(sum(b.comissao_cents), 0))::bigint,
         (coalesce(cc.piso_cents, pa.piso) + coalesce(sum(b.comissao_cents), 0))::bigint,
         (coalesce(cc.teto_cents, pa.teto) is not null
            and coalesce(cc.piso_cents, pa.piso) + coalesce(sum(b.comissao_cents), 0) > coalesce(cc.teto_cents, pa.teto)),
         case when sum(b.monthly_cents) > 0
              then round((coalesce(cc.piso_cents, pa.piso) + coalesce(sum(b.comissao_cents), 0))::numeric
                         / sum(b.monthly_cents)::numeric, 4) end
    from base b
    join onboarding_staff stf on stf.id = b.consultant_id
    cross join padrao pa
    left join consultant_commission_config cc on cc.consultant_id = b.consultant_id
   group by b.consultant_id, b.consultant_name,
            cc.piso_cents, cc.percentual, cc.teto_cents, pa.piso, pa.pct, pa.teto
   order by 14 desc;
end
$$;

revoke all on function public.carteira_comissao_resumo(uuid) from public;
grant execute on function public.carteira_comissao_resumo(uuid) to authenticated;
