-- Painel de KPIs do cliente: funil de atendimentos, clientes (novos, recorrentes, LTV) e investimento
-- (CAC). 14/10/2026, pedido do Fabrício: "colocar CAC, gráfico de funil, pegando os atendimentos do
-- sistema deles, LTV tanto em valor quanto em tempo". Os dados vêm do sistema do cliente (3D Cure HQ,
-- recursos funil/clientes/investimento da api-dashboard) pela edge threedcure-funil-sync. As tabelas são
-- genéricas por empresa: outro cliente pode alimentar as mesmas tabelas por outra integração.
-- Sem policy: só a RPC painel_kpis_public (security definer) e o service_role leem.

create table if not exists public.kpi_funil_etapas (
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  chave text not null,
  rotulo text not null,
  ordem int not null,
  updated_at timestamptz not null default now(),
  primary key (company_id, chave)
);

create table if not exists public.kpi_funil_diario (
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  data date not null,
  vendedora text not null default '',            -- nome como veio do sistema do cliente ('' = sem vendedora)
  salesperson_id uuid references public.company_salespeople(id) on delete set null,
  canal text,
  etapa text not null,
  quantidade numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (company_id, data, vendedora, etapa)
);

create table if not exists public.kpi_funil_perdas (
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  mes date not null,
  motivo text not null,
  quantidade numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (company_id, mes, motivo)
);

create table if not exists public.kpi_clientes_mensal (
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  mes date not null,
  novos numeric, recorrentes numeric, ativos numeric,
  faturamento_novos numeric, faturamento_recorrentes numeric,
  updated_at timestamptz not null default now(),
  primary key (company_id, mes)
);

create table if not exists public.kpi_clientes_vendedora (
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  mes date not null,
  vendedora text not null,
  salesperson_id uuid references public.company_salespeople(id) on delete set null,
  novos numeric, recorrentes numeric,
  updated_at timestamptz not null default now(),
  primary key (company_id, mes, vendedora)
);

create table if not exists public.kpi_clientes_ltv (
  company_id uuid primary key references public.onboarding_companies(id) on delete cascade,
  valor numeric, meses numeric, compras_por_cliente numeric, taxa_recompra numeric,
  base_clientes numeric, desde date,
  updated_at timestamptz not null default now()
);

create table if not exists public.kpi_investimento_mensal (
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  mes date not null,
  midia numeric, time_comercial numeric, outros numeric,
  fonte text not null default 'sistema',
  updated_at timestamptz not null default now(),
  primary key (company_id, mes)
);

do $$ declare t text; begin
  foreach t in array array['kpi_funil_etapas','kpi_funil_diario','kpi_funil_perdas','kpi_clientes_mensal','kpi_clientes_vendedora','kpi_clientes_ltv','kpi_investimento_mensal'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- painel_kpis_public ganha os blocos novos (o resto da função não muda)
create or replace function public.painel_kpis_public(p_token text, p_mes date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_co uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_atual date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_mes date;
  v_ini date;
  v_fim date;
  v_kf uuid;
  v_kv uuid;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select l.company_id into v_co from kpi_painel_links l where l.token = p_token and l.is_active;
  if v_co is null then return null; end if;

  v_mes := date_trunc('month', coalesce(p_mes, v_hoje))::date;
  if v_mes > v_atual then v_mes := v_atual; end if;
  v_ini := (v_atual - interval '12 months')::date;
  if v_mes < v_ini then v_ini := v_mes; end if;
  v_fim := (v_atual + interval '1 month' - interval '1 day')::date;

  select id into v_kf from company_kpis where company_id = v_co and is_active and kpi_type = 'monetary'
    order by (name ilike 'fatura%') desc, coalesce(is_main_goal, false) desc, sort_order nulls last, created_at limit 1;
  select id into v_kv from company_kpis where company_id = v_co and is_active and kpi_type <> 'monetary'
    order by (name ilike 'venda%') desc, sort_order nulls last, created_at limit 1;

  return jsonb_build_object(
    'empresa', (select name from onboarding_companies where id = v_co),
    'hoje', v_hoje,
    'mes', v_mes,
    'atualizado_em', (select max(updated_at) from kpi_entries where company_id = v_co and kpi_id in (v_kf, v_kv)),
    'kpis', jsonb_build_object(
      'fat', (select jsonb_build_object('id', id, 'nome', name) from company_kpis where id = v_kf),
      'vendas', (select jsonb_build_object('id', id, 'nome', name) from company_kpis where id = v_kv)
    ),
    'unidades', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', name) order by name)
      from company_units where company_id = v_co and coalesce(is_active, true)), '[]'::jsonb),
    'times', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', name, 'unidade', unit_id) order by name)
      from company_teams where company_id = v_co and coalesce(is_active, true)), '[]'::jsonb),
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'nome', s.name, 'ativo', s.is_active, 'ranking', not coalesce(s.exclude_from_ranking, false),
        'unidade', coalesce(s.unit_id, (select e.unit_id from kpi_entries e where e.salesperson_id = s.id and e.unit_id is not null order by e.entry_date desc limit 1)),
        'time', s.team_id) order by s.name)
      from company_salespeople s
      where s.company_id = v_co
        and (s.is_active or exists (select 1 from kpi_entries e where e.salesperson_id = s.id and e.entry_date between v_ini and v_fim))
    ), '[]'::jsonb),
    'mensal', coalesce((
      select jsonb_agg(jsonb_build_array(m, sp, fat, qtd) order by m, sp)
      from (
        select date_trunc('month', entry_date)::date m, salesperson_id sp,
               coalesce(sum(value) filter (where kpi_id = v_kf), 0) fat,
               coalesce(sum(value) filter (where kpi_id = v_kv), 0) qtd
        from kpi_entries
        where company_id = v_co and kpi_id in (v_kf, v_kv) and entry_date between v_ini and v_fim
        group by 1, 2
      ) x
    ), '[]'::jsonb),
    'metas', coalesce((
      select jsonb_agg(jsonb_build_array(m, sp, fat, qtd) order by m, sp)
      from (
        select (month_year || '-01')::date m, salesperson_id sp,
               sum(target_value) filter (where kpi_id = v_kf) fat,
               sum(target_value) filter (where kpi_id = v_kv) qtd
        from kpi_monthly_targets
        where company_id = v_co and kpi_id in (v_kf, v_kv)
          and coalesce(level_order, 1) = 1 and unit_id is null and team_id is null and sector_id is null
          and month_year between to_char(v_ini, 'YYYY-MM') and to_char(v_fim, 'YYYY-MM')
        group by 1, 2
      ) x
    ), '[]'::jsonb),
    'diario', coalesce((
      select jsonb_agg(jsonb_build_array(d, sp, fat, qtd) order by d, sp)
      from (
        select entry_date d, salesperson_id sp,
               coalesce(sum(value) filter (where kpi_id = v_kf), 0) fat,
               coalesce(sum(value) filter (where kpi_id = v_kv), 0) qtd
        from kpi_entries
        where company_id = v_co and kpi_id in (v_kf, v_kv)
          and entry_date between (v_mes - interval '1 month')::date and (v_mes + interval '1 month' - interval '1 day')::date
        group by 1, 2
      ) x
    ), '[]'::jsonb),
    -- funil: etapas e [dia, vendedora, etapa, quantidade] do mês escolhido e do anterior
    'funil', jsonb_build_object(
      'etapas', coalesce((select jsonb_agg(jsonb_build_object('chave', chave, 'rotulo', rotulo, 'ordem', ordem) order by ordem)
        from kpi_funil_etapas where company_id = v_co), '[]'::jsonb),
      'diario', coalesce((
        select jsonb_agg(jsonb_build_array(data, salesperson_id, etapa, q) order by data)
        from (
          select data, salesperson_id, etapa, sum(quantidade) q from kpi_funil_diario
          where company_id = v_co
            and data between (v_mes - interval '1 month')::date and (v_mes + interval '1 month' - interval '1 day')::date
          group by 1, 2, 3
        ) x
      ), '[]'::jsonb),
      'perdas', coalesce((select jsonb_agg(jsonb_build_object('motivo', motivo, 'quantidade', quantidade) order by quantidade desc)
        from kpi_funil_perdas where company_id = v_co and mes = v_mes), '[]'::jsonb),
      'atualizado_em', (select max(updated_at) from kpi_funil_diario where company_id = v_co)
    ),
    -- clientes: 13 meses, LTV e novos/recorrentes por vendedora no mês
    'clientes', jsonb_build_object(
      'mensal', coalesce((select jsonb_agg(jsonb_build_object('mes', mes, 'novos', novos, 'recorrentes', recorrentes, 'ativos', ativos,
          'fat_novos', faturamento_novos, 'fat_recorrentes', faturamento_recorrentes) order by mes)
        from kpi_clientes_mensal where company_id = v_co and mes between v_ini and v_fim), '[]'::jsonb),
      'ltv', (select jsonb_build_object('valor', valor, 'meses', meses, 'compras', compras_por_cliente, 'recompra', taxa_recompra,
          'base', base_clientes, 'desde', desde, 'atualizado_em', updated_at) from kpi_clientes_ltv where company_id = v_co),
      'por_vendedora', coalesce((select jsonb_agg(jsonb_build_object('id', salesperson_id, 'nome', vendedora, 'novos', novos, 'recorrentes', recorrentes))
        from kpi_clientes_vendedora where company_id = v_co and mes = v_mes), '[]'::jsonb)
    ),
    -- investimento por mês (CAC)
    'investimento', coalesce((select jsonb_agg(jsonb_build_object('mes', mes, 'midia', midia, 'time', time_comercial, 'outros', outros) order by mes)
      from kpi_investimento_mensal where company_id = v_co and mes between v_ini and v_fim), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.painel_kpis_public(text, date) from public;
grant execute on function public.painel_kpis_public(text, date) to anon, authenticated, service_role;
