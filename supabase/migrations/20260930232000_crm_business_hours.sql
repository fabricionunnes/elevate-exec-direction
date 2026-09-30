-- Horário de trabalho da empresa (Configurações do CRM > Horário de Trabalho)
-- e função crm_business_seconds_between(a, b): segundos úteis entre dois instantes,
-- contando só o que cai dentro do expediente (dias marcados como abertos, pulando
-- feriados). Sem linha em crm_business_hours, vale seg a sex 08:00 às 18:00 (Brasília).
-- Uso previsto: dashboards de atendimento (tempo de 1ª resposta em horas úteis).

create table if not exists public.crm_business_hours (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null unique check (weekday between 0 and 6),   -- 0 = domingo
  is_open boolean not null default true,
  open_time time without time zone not null default '08:00',
  close_time time without time zone not null default '18:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_business_hours_times_check check (open_time < close_time)
);

create table if not exists public.crm_holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.crm_business_hours enable row level security;
alter table public.crm_holidays enable row level security;

drop policy if exists "Staff le horario de trabalho" on public.crm_business_hours;
create policy "Staff le horario de trabalho" on public.crm_business_hours
  for select to authenticated using (public.get_current_staff_id() is not null);
drop policy if exists "Admin gerencia horario de trabalho" on public.crm_business_hours;
create policy "Admin gerencia horario de trabalho" on public.crm_business_hours
  for all to authenticated using (public.crm_is_settings_admin()) with check (public.crm_is_settings_admin());

drop policy if exists "Staff le feriados" on public.crm_holidays;
create policy "Staff le feriados" on public.crm_holidays
  for select to authenticated using (public.get_current_staff_id() is not null);
drop policy if exists "Admin gerencia feriados" on public.crm_holidays;
create policy "Admin gerencia feriados" on public.crm_holidays
  for all to authenticated using (public.crm_is_settings_admin()) with check (public.crm_is_settings_admin());

grant select, insert, update, delete on public.crm_business_hours to authenticated;
grant select, insert, update, delete on public.crm_holidays to authenticated;
grant select on public.crm_business_hours, public.crm_holidays to service_role;

-- Feriados nacionais que ainda faltam em 2026 (a tela permite editar).
insert into public.crm_holidays (date, name) values
  ('2026-10-12', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamação da República'),
  ('2026-11-20', 'Consciência Negra'),
  ('2026-12-25', 'Natal')
on conflict (date) do nothing;

-- Segundos úteis entre a e b. Hora local de Brasília. b <= a devolve 0.
create or replace function public.crm_business_seconds_between(a timestamptz, b timestamptz)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'America/Sao_Paulo';
  v_start timestamp;
  v_end timestamp;
  v_day date;
  v_last date;
  v_has_config boolean;
  v_is_open boolean;
  v_open time;
  v_close time;
  v_win_start timestamp;
  v_win_end timestamp;
  v_total bigint := 0;
begin
  if a is null or b is null or b <= a then
    return 0;
  end if;

  v_start := a at time zone v_tz;
  v_end := b at time zone v_tz;
  v_day := v_start::date;
  v_last := v_end::date;

  select exists (select 1 from public.crm_business_hours) into v_has_config;

  while v_day <= v_last loop
    if v_has_config then
      select h.is_open, h.open_time, h.close_time
        into v_is_open, v_open, v_close
        from public.crm_business_hours h
       where h.weekday = extract(dow from v_day)::int;
      if not found then
        v_is_open := false;
      end if;
    else
      v_is_open := extract(dow from v_day) between 1 and 5;
      v_open := '08:00';
      v_close := '18:00';
    end if;

    if v_is_open
       and v_open < v_close
       and not exists (select 1 from public.crm_holidays f where f.date = v_day) then
      v_win_start := greatest(v_day + v_open, v_start);
      v_win_end := least(v_day + v_close, v_end);
      if v_win_end > v_win_start then
        v_total := v_total + floor(extract(epoch from (v_win_end - v_win_start)))::bigint;
      end if;
    end if;

    v_day := v_day + 1;
  end loop;

  return v_total;
end;
$$;

comment on function public.crm_business_seconds_between(timestamptz, timestamptz) is
  'Segundos dentro do horário de trabalho entre a e b (crm_business_hours + crm_holidays; padrão seg-sex 08:00-18:00 Brasília se vazio).';

grant execute on function public.crm_business_seconds_between(timestamptz, timestamptz) to authenticated, service_role;
