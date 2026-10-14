-- Painel de Controle de KPIs do cliente por link público (14/10/2026, pedido do Fabrício: "painel
-- parecido com o nosso painel de controle, porém para a 3D Cure, link separado, buscando os dados
-- atualizados das automações que já temos").
-- Serve qualquer empresa que lance Faturamento e Vendas no módulo de KPIs (a 3D Cure é a primeira:
-- threedcure-sync grava kpi_entries a cada 2 minutos). Lê direto das tabelas de KPI, sem foto
-- intermediária: o painel mostra o que está no banco na hora em que abre.
-- O link é /#/painel-kpis/<token>. Só leitura, só com o token, nunca devolve dado de outra empresa.

create table if not exists public.kpi_painel_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  token text not null unique check (length(token) >= 32),
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.kpi_painel_links enable row level security;
-- sem policy: ninguém lê a tabela pela API; o acesso é só pela função abaixo
grant all on public.kpi_painel_links to service_role;

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
  v_ini date;      -- início da série de 13 meses
  v_fim date;      -- fim da série (último dia do mês atual)
  v_kf uuid;       -- KPI de faturamento (monetário)
  v_kv uuid;       -- KPI de vendas (quantidade)
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
    -- pessoas ativas ou com lançamento na janela; unidade e time do cadastro, com a unidade do lançamento como reserva
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'nome', s.name, 'ativo', s.is_active, 'ranking', not coalesce(s.exclude_from_ranking, false),
        'unidade', coalesce(s.unit_id, (select e.unit_id from kpi_entries e where e.salesperson_id = s.id and e.unit_id is not null order by e.entry_date desc limit 1)),
        'time', s.team_id) order by s.name)
      from company_salespeople s
      where s.company_id = v_co
        and (s.is_active or exists (select 1 from kpi_entries e where e.salesperson_id = s.id and e.entry_date between v_ini and v_fim))
    ), '[]'::jsonb),
    -- [mês, vendedora, faturamento, vendas] dos 13 meses
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
    -- [mês, vendedora (null = linha da empresa), meta faturamento, meta vendas], nível principal
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
    -- [dia, vendedora, faturamento, vendas] do mês escolhido e do anterior (comparação no mesmo período)
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
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.painel_kpis_public(text, date) from public;
grant execute on function public.painel_kpis_public(text, date) to anon, authenticated, service_role;
