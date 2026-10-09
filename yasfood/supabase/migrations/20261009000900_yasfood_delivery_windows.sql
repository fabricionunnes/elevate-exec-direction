-- Janelas de entrega/retirada: faixa de horário por dia da semana, com antecedência mínima própria.
create table if not exists yasfood.delivery_windows (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',                 -- opcional: "Tarde", "Noite"
  start_time time not null,
  end_time time not null,
  weekdays int[] not null default array[1,2,3,4,5,6],   -- 0=dom … 6=sáb
  min_lead_minutes int not null default 120,       -- pode pedir até X minutos antes do início
  applies_to text not null default 'ambos' check (applies_to in ('ambos','entrega','retirada')),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
alter table yasfood.delivery_windows enable row level security;
drop policy if exists windows_public_read on yasfood.delivery_windows;
create policy windows_public_read on yasfood.delivery_windows for select using (active or yasfood.is_admin());
drop policy if exists windows_admin_all on yasfood.delivery_windows;
create policy windows_admin_all on yasfood.delivery_windows for all using (yasfood.is_admin()) with check (yasfood.is_admin());
grant select on yasfood.delivery_windows to anon;
grant select, insert, update, delete on yasfood.delivery_windows to authenticated;

alter table yasfood.orders
  add column if not exists window_id uuid references yasfood.delivery_windows(id) on delete set null,
  add column if not exists window_label text;      -- ex.: "14:00–16:00" (fica gravado mesmo se a janela mudar)

create or replace function yasfood.now_br()
returns timestamp language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::timestamp $$;

-- Janelas de um dia, com flag se ainda dá tempo de pedir (público)
create or replace function yasfood.available_windows(p_date date, p_fulfillment text default 'ambos')
returns table (id uuid, label text, start_time time, end_time time, min_lead_minutes int, applies_to text, bookable boolean, closes_at timestamp)
language sql stable security definer set search_path = yasfood, public as $$
  select w.id, w.label, w.start_time, w.end_time, w.min_lead_minutes, w.applies_to,
         ((p_date + w.start_time) - make_interval(mins => w.min_lead_minutes)) > yasfood.now_br() as bookable,
         ((p_date + w.start_time) - make_interval(mins => w.min_lead_minutes)) as closes_at
  from yasfood.delivery_windows w
  where w.active
    and extract(dow from p_date)::int = any(w.weekdays)
    and (p_fulfillment = 'ambos' or w.applies_to = 'ambos' or w.applies_to = p_fulfillment)
  order by w.start_time, w.sort_order;
$$;
grant execute on function yasfood.available_windows(date, text) to anon, authenticated;
revoke execute on function yasfood.now_br() from public;
grant execute on function yasfood.now_br() to anon, authenticated;

-- Janelas iniciais (ajustáveis no painel)
insert into yasfood.delivery_windows (label, start_time, end_time, weekdays, min_lead_minutes, sort_order)
select * from (values
  ('Tarde', '14:00'::time, '17:00'::time, array[1,2,3,4,5,6], 120, 1),
  ('Noite', '18:00'::time, '21:00'::time, array[1,2,3,4,5], 120, 2)
) as v(label, start_time, end_time, weekdays, min_lead_minutes, sort_order)
where not exists (select 1 from yasfood.delivery_windows);
