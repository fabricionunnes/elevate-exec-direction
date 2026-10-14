-- Funil e clientes/LTV da 3D Cure a partir do Agendor (14/10/2026). A edge threedcure-agendor-painel
-- copia um resumo de cada negócio (sem nome nem contato do cliente: só o código da empresa/pessoa no
-- Agendor) e esta função consolida nas tabelas do Painel de KPIs (kpi_funil_*, kpi_clientes_*).
-- Regras (cohort pela data de criação do negócio):
--   Atendimentos = negócio aberto no dia (cada negócio no Agendor é um atendimento; inclui listas de prospecção)
--   Negociação = chegou na etapa "Negociação" (ou depois) do funil dele, ou foi ganho
--   Venda      = ganho
-- (não há etapa "atendido": os negócios já nascem fora da 1ª etapa em vários funis, então ela repetia a carteira)
-- Clientes (pela data do ganho): novo = primeiro ganho da história do cliente; recompra = já tinha ganho antes.

create table if not exists public.agendor_negocios (
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  id bigint not null,
  funil text, etapa text, etapa_seq int,
  status smallint,                 -- 1 em andamento, 2 ganho, 3 perdido
  atendido boolean not null default false,
  negociou boolean not null default false,
  dono text,
  salesperson_id uuid references public.company_salespeople(id) on delete set null,
  cliente text,                    -- 'o:<id>' empresa ou 'p:<id>' pessoa no Agendor
  valor numeric,
  criado_em timestamptz,
  ganho_em date,                   -- data de fechamento (endTime) ou do ganho
  perdido_em date,
  motivo_perda text,
  atualizado_em timestamptz,
  primary key (company_id, id)
);
create index if not exists agendor_negocios_criado on public.agendor_negocios (company_id, criado_em);
create index if not exists agendor_negocios_ganho on public.agendor_negocios (company_id, ganho_em) where status = 2;
alter table public.agendor_negocios enable row level security;
grant all on public.agendor_negocios to service_role;

create or replace function public.agendor_consolidar_painel(p_company uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text := 'America/Sao_Paulo';
  v_ini date := (date_trunc('month', now() at time zone v_tz) - interval '13 months')::date;
  n_funil int; n_cli int;
begin
  -- etapas genéricas (os 15 funis do Agendor têm etapas diferentes; aqui vale o que é comum a todos)
  delete from kpi_funil_etapas where company_id = p_company;
  insert into kpi_funil_etapas (company_id, chave, rotulo, ordem) values
    (p_company, 'atendimento', 'Atendimentos', 1),
    (p_company, 'negociacao', 'Em negociação', 2),
    (p_company, 'venda', 'Venda', 3);

  -- funil por dia e vendedora (14 meses)
  delete from kpi_funil_diario where company_id = p_company and data >= v_ini;
  insert into kpi_funil_diario (company_id, data, vendedora, salesperson_id, etapa, quantidade)
  select p_company, (n.criado_em at time zone v_tz)::date, coalesce(n.dono, ''), max(n.salesperson_id::text)::uuid, x.e, sum(x.q)
  from agendor_negocios n
  cross join lateral (values
    ('atendimento', 1),
    ('negociacao', case when n.negociou then 1 else 0 end),
    ('venda', case when n.status = 2 then 1 else 0 end)) as x(e, q)
  where n.company_id = p_company and n.criado_em >= v_ini
  group by 2, 3, 5
  having sum(x.q) > 0;
  get diagnostics n_funil = row_count;

  -- motivos de perda por mês (pela data da perda)
  delete from kpi_funil_perdas where company_id = p_company and mes >= v_ini;
  insert into kpi_funil_perdas (company_id, mes, motivo, quantidade)
  select p_company, date_trunc('month', perdido_em)::date, coalesce(nullif(motivo_perda, ''), 'Sem motivo informado'), count(*)
  from agendor_negocios where company_id = p_company and status = 3 and perdido_em >= v_ini
  group by 2, 3;

  -- clientes por mês do ganho: novos x recompra
  delete from kpi_clientes_mensal where company_id = p_company;
  insert into kpi_clientes_mensal (company_id, mes, novos, recorrentes, ativos, faturamento_novos, faturamento_recorrentes)
  with g as (
    select cliente, ganho_em, valor, salesperson_id, dono,
           min(ganho_em) over (partition by cliente) primeiro
    from agendor_negocios where company_id = p_company and status = 2 and cliente is not null and ganho_em is not null
  ), m as (
    select date_trunc('month', ganho_em)::date mes, cliente,
           bool_or(date_trunc('month', primeiro) = date_trunc('month', ganho_em)) novo, sum(valor) v
    from g group by 1, 2
  )
  select p_company, mes, count(*) filter (where novo), count(*) filter (where not novo), count(*),
         sum(v) filter (where novo), sum(v) filter (where not novo)
  from m where mes >= v_ini group by mes;
  get diagnostics n_cli = row_count;

  -- novos x recompra por vendedora e mês
  delete from kpi_clientes_vendedora where company_id = p_company;
  insert into kpi_clientes_vendedora (company_id, mes, vendedora, salesperson_id, novos, recorrentes)
  with g as (
    select cliente, ganho_em, coalesce(dono, '') dono, salesperson_id,
           min(ganho_em) over (partition by cliente) primeiro
    from agendor_negocios where company_id = p_company and status = 2 and cliente is not null and ganho_em is not null
  )
  select p_company, date_trunc('month', ganho_em)::date, dono, max(salesperson_id::text)::uuid,
         count(distinct cliente) filter (where date_trunc('month', primeiro) = date_trunc('month', ganho_em)),
         count(distinct cliente) filter (where date_trunc('month', primeiro) < date_trunc('month', ganho_em))
  from g where ganho_em >= v_ini group by 2, 3;

  -- LTV com toda a história de ganhos do Agendor
  insert into kpi_clientes_ltv (company_id, valor, meses, compras_por_cliente, taxa_recompra, base_clientes, desde, updated_at)
  select p_company, sum(tot) / nullif(count(*), 0),
         avg(((extract(year from ult) - extract(year from pri)) * 12 + extract(month from ult) - extract(month from pri)) + 1),
         avg(n), avg(case when n > 1 then 1.0 else 0 end), count(*), min(pri), now()
  from (
    select cliente, sum(valor) tot, count(*) n, min(ganho_em) pri, max(ganho_em) ult
    from agendor_negocios where company_id = p_company and status = 2 and cliente is not null and ganho_em is not null
    group by cliente
  ) c
  on conflict (company_id) do update set valor = excluded.valor, meses = excluded.meses, compras_por_cliente = excluded.compras_por_cliente,
    taxa_recompra = excluded.taxa_recompra, base_clientes = excluded.base_clientes, desde = excluded.desde, updated_at = now();

  return jsonb_build_object('funil_linhas', n_funil, 'meses_clientes', n_cli);
end;
$$;
revoke all on function public.agendor_consolidar_painel(uuid) from public, anon, authenticated;
grant execute on function public.agendor_consolidar_painel(uuid) to service_role;
