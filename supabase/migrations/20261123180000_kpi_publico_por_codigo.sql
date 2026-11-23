-- Segurança, etapa 2 (parte 2): lançamento público de KPI (vendedor e gestor).
-- Antes: as páginas /kpi-entry e /kpi-gestor liam e gravavam direto nas tabelas,
-- que por isso ficavam abertas pra qualquer visitante (ler, criar, alterar e apagar).
-- Agora tudo passa por funções que conferem o código de acesso e só enxergam
-- a empresa daquele código.

-- Vendedor do código (uso interno das funções abaixo).
create or replace function public.kpi_entry_vendedor(p_company_id uuid, p_code text)
returns public.company_salespeople
language sql
stable
security definer
set search_path = public
as $$
  select sp.*
  from public.company_salespeople sp
  where p_company_id is not null
    and p_code is not null
    and length(btrim(p_code)) >= 4
    and sp.access_code = btrim(p_code)
    and sp.company_id = p_company_id
    and sp.is_active
  order by sp.created_at
  limit 1
$$;
revoke all on function public.kpi_entry_vendedor(uuid, text) from public, anon, authenticated;

-- Tudo que a tela do vendedor precisa, já escopado na empresa do código.
create or replace function public.kpi_entry_dados(p_company_id uuid, p_code text, p_date date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sp public.company_salespeople;
  v_date date := coalesce(p_date, current_date);
  v_month text;
  v_ini date;
  v_fim date;
begin
  select * into sp from public.kpi_entry_vendedor(p_company_id, p_code);
  if sp.id is null then
    return null;
  end if;

  v_month := to_char(v_date, 'YYYY-MM');
  v_ini := date_trunc('month', v_date)::date;
  v_fim := (date_trunc('month', v_date) + interval '1 month - 1 day')::date;

  return jsonb_build_object(
    'salesperson', jsonb_build_object(
      'id', sp.id, 'name', sp.name, 'access_code', sp.access_code, 'company_id', sp.company_id,
      'unit_id', sp.unit_id, 'team_id', sp.team_id, 'sector_id', sp.sector_id),
    'company', (select jsonb_build_object('id', c.id, 'name', c.name)
                from public.onboarding_companies c where c.id = p_company_id),
    -- Equipe e unidades: a página pública nunca enxergou essas duas tabelas (sempre
    -- foram fechadas a visitante), então o seletor de unidade não aparece e o
    -- lançamento sai com a unidade do cadastro do vendedor. Mantido assim de propósito.
    'team', null,
    'salesperson_sector_ids', coalesce((
      select jsonb_agg(ss.sector_id) from public.salesperson_sectors ss where ss.salesperson_id = sp.id
    ), '[]'::jsonb),
    'sectors', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name)
      from public.company_sectors s where s.company_id = p_company_id
    ), '[]'::jsonb),
    'units', '[]'::jsonb,
    'kpis', coalesce((
      select jsonb_agg(to_jsonb(k) order by k.sort_order, k.name)
      from public.company_kpis k where k.company_id = p_company_id and k.is_active
    ), '[]'::jsonb),
    'kpi_units', coalesce((
      select jsonb_agg(jsonb_build_object('kpi_id', x.kpi_id, 'unit_id', x.unit_id))
      from public.kpi_units x join public.company_kpis k on k.id = x.kpi_id and k.company_id = p_company_id and k.is_active
    ), '[]'::jsonb),
    'kpi_sectors', coalesce((
      select jsonb_agg(jsonb_build_object('kpi_id', x.kpi_id, 'sector_id', x.sector_id))
      from public.kpi_sectors x join public.company_kpis k on k.id = x.kpi_id and k.company_id = p_company_id and k.is_active
    ), '[]'::jsonb),
    'kpi_teams', coalesce((
      select jsonb_agg(jsonb_build_object('kpi_id', x.kpi_id, 'team_id', x.team_id))
      from public.kpi_teams x join public.company_kpis k on k.id = x.kpi_id and k.company_id = p_company_id and k.is_active
    ), '[]'::jsonb),
    'kpi_salespeople', coalesce((
      select jsonb_agg(jsonb_build_object('kpi_id', x.kpi_id, 'salesperson_id', x.salesperson_id))
      from public.kpi_salespeople x join public.company_kpis k on k.id = x.kpi_id and k.company_id = p_company_id and k.is_active
    ), '[]'::jsonb),
    'goal_settings', (
      select jsonb_build_object('include_saturday', g.include_saturday, 'include_sunday', g.include_sunday,
                                'include_holidays', g.include_holidays)
      from public.company_daily_goal_settings g where g.company_id = p_company_id limit 1),
    'month', v_month,
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object('kpi_id', t.kpi_id, 'target_value', t.target_value,
                                          'level_name', t.level_name, 'level_order', t.level_order,
                                          'salesperson_id', t.salesperson_id, 'unit_id', t.unit_id, 'team_id', t.team_id))
      from public.kpi_monthly_targets t where t.company_id = p_company_id and t.month_year = v_month
    ), '[]'::jsonb),
    'salespeople', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'unit_id', o.unit_id, 'team_id', o.team_id, 'sector_id', o.sector_id))
      from public.company_salespeople o where o.company_id = p_company_id and o.is_active
    ), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object('kpi_id', e.kpi_id, 'value', e.value, 'entry_date', e.entry_date))
      from public.kpi_entries e
      where e.salesperson_id = sp.id and e.entry_date between v_ini and v_fim
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.kpi_entry_dados(uuid, text, date) from public;
grant execute on function public.kpi_entry_dados(uuid, text, date) to anon, authenticated, service_role;

-- Grava o lançamento do vendedor (cria ou atualiza o dia).
create or replace function public.kpi_entry_salvar(
  p_company_id uuid, p_code text, p_date date, p_itens jsonb,
  p_observations text default null, p_unit_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.company_salespeople;
  k public.company_kpis;
  it jsonb;
  v_unit uuid;
  v_sectors uuid[];
  n int := 0;
begin
  select * into sp from public.kpi_entry_vendedor(p_company_id, p_code);
  if sp.id is null then
    raise exception 'Código de acesso inválido';
  end if;
  if p_date is null then
    raise exception 'Data do lançamento não informada';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 300 then
    raise exception 'Lançamento inválido';
  end if;

  select coalesce((select u.id from public.company_units u where u.id = p_unit_id and u.company_id = p_company_id), sp.unit_id)
    into v_unit;

  select array(
    select distinct x from (
      select ss.sector_id as x from public.salesperson_sectors ss where ss.salesperson_id = sp.id
      union
      select sp.sector_id
    ) q where x is not null
  ) into v_sectors;

  for it in select * from jsonb_array_elements(p_itens) loop
    select * into k from public.company_kpis c
     where c.id = nullif(it->>'kpi_id', '')::uuid and c.company_id = p_company_id and c.is_active;
    if k.id is null then
      continue;
    end if;
    insert into public.kpi_entries
      (company_id, salesperson_id, kpi_id, entry_date, value, observations, unit_id, team_id, sector_id, updated_at)
    values
      (p_company_id, sp.id, k.id, p_date, coalesce(nullif(it->>'value', '')::numeric, 0), p_observations, v_unit, sp.team_id,
       coalesce(k.sector_id, case when cardinality(v_sectors) = 1 then v_sectors[1] end), now())
    on conflict (salesperson_id, kpi_id, entry_date) do update
      set value = excluded.value,
          observations = excluded.observations,
          unit_id = excluded.unit_id,
          updated_at = now();
    n := n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'salvos', n);
end;
$$;
revoke all on function public.kpi_entry_salvar(uuid, text, date, jsonb, text, uuid) from public;
grant execute on function public.kpi_entry_salvar(uuid, text, date, jsonb, text, uuid) to anon, authenticated, service_role;

-- Gestor: empresa do código (uso interno).
create or replace function public.kpi_manager_empresa(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select l.company_id
  from public.kpi_manager_links l
  where p_code is not null and length(btrim(p_code)) >= 4 and l.code = btrim(p_code) and l.is_active
  limit 1
$$;
revoke all on function public.kpi_manager_empresa(text) from public, anon, authenticated;

-- Gestor: lançamentos da empresa na data.
create or replace function public.kpi_manager_entries(p_code text, p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid := public.kpi_manager_empresa(p_code);
begin
  if v_company is null or p_date is null then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('salesperson_id', e.salesperson_id, 'kpi_id', e.kpi_id, 'value', e.value))
    from public.kpi_entries e
    where e.company_id = v_company and e.entry_date = p_date
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.kpi_manager_entries(text, date) from public;
grant execute on function public.kpi_manager_entries(text, date) to anon, authenticated, service_role;

-- Gestor: grava as células alteradas.
create or replace function public.kpi_manager_save(p_code text, p_date date, p_cells jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.kpi_manager_empresa(p_code);
  sp public.company_salespeople;
  k public.company_kpis;
  it jsonb;
  v_sector uuid;
  n int := 0;
begin
  if v_company is null then
    raise exception 'Código inválido ou desativado';
  end if;
  if p_date is null then
    raise exception 'Data do lançamento não informada';
  end if;
  if p_cells is null or jsonb_typeof(p_cells) <> 'array' or jsonb_array_length(p_cells) > 3000 then
    raise exception 'Lançamento inválido';
  end if;

  for it in select * from jsonb_array_elements(p_cells) loop
    select * into sp from public.company_salespeople s
     where s.id = nullif(it->>'salesperson_id', '')::uuid and s.company_id = v_company;
    select * into k from public.company_kpis c
     where c.id = nullif(it->>'kpi_id', '')::uuid and c.company_id = v_company;
    if sp.id is null or k.id is null or nullif(it->>'value', '') is null then
      continue;
    end if;

    select coalesce(k.sector_id, sp.sector_id, (
      select min(ss.sector_id::text)::uuid from public.salesperson_sectors ss
      where ss.salesperson_id = sp.id having count(*) = 1)) into v_sector;

    insert into public.kpi_entries
      (company_id, salesperson_id, kpi_id, entry_date, value, unit_id, team_id, sector_id, observations)
    values
      (v_company, sp.id, k.id, p_date, (it->>'value')::numeric, sp.unit_id, sp.team_id, v_sector, 'Lançamento gerencial')
    on conflict (salesperson_id, kpi_id, entry_date) do update
      set value = excluded.value, updated_at = now();
    n := n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'salvos', n);
end;
$$;
revoke all on function public.kpi_manager_save(text, date, jsonb) from public;
grant execute on function public.kpi_manager_save(text, date, jsonb) to anon, authenticated, service_role;
