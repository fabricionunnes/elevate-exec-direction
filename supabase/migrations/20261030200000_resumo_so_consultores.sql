-- O painel de comissao e dos consultores. O Fabricio e dono e a Carol e socia
-- na UNV Social: os dois carregam cliente, mas nao sao comissionados, entao
-- inflavam o custo do time na leitura da tela. A regra deles continua salva na
-- config, so nao aparece aqui.

drop function if exists public.carteira_comissao_resumo(uuid);

-- Resumo por pessoa: o que ela ganha entregando mais o que ganha tendo vendido.
-- Master ve todo mundo; quem tem ve_comissao ligado ve so a propria linha.
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
  peso numeric,
  percentual_venda numeric,
  percentual_venda_unica numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff  uuid;
  v_role   text;
  v_ve     boolean;
  v_filter uuid;
begin
  select s.id, s.role, coalesce(s.ve_comissao, false)
    into v_staff, v_role, v_ve
    from onboarding_staff s
   where s.user_id = auth.uid() and s.is_active
   limit 1;

  if v_staff is null then
    return;
  end if;

  if v_role = 'master' then
    v_filter := p_consultant_id;
  elsif v_ve then
    v_filter := v_staff;
  else
    return;
  end if;

  return query
  with padrao as (
    select cfg.piso_cents as piso, cfg.percentual as pct, cfg.teto_cents as teto,
           cfg.percentual_venda as pctv, cfg.percentual_venda_unica as pctvu
      from consultant_commission_config cfg where cfg.consultant_id is null limit 1
  ),
  base as (
    select * from carteira_consultores_raw()
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
                         / (coalesce(e.cart, 0) + coalesce(v.cart, 0))::numeric, 4) end,
         pa.pctv,
         pa.pctvu
    from pessoas p
    join onboarding_staff stf on stf.id = p.sid
    cross join padrao pa
    left join entrega e on e.sid = p.sid
    left join venda   v on v.sid = p.sid
    left join consultant_commission_config cc on cc.consultant_id = p.sid
   where stf.role = 'consultant'
     and (v_filter is null or p.sid = v_filter)
   order by 19 desc;
end
$$;



