-- 1) Pedido pra hoje: a antecedência passa a ser por horário (cada horário tem "pedir até X antes").
--    A antecedência em dias (min_lead_days) vai pra 0; o dia de hoje só aparece se ainda houver horário aberto.
-- 2) Limite de pedidos por horário (max_orders na janela; vazio = sem limite). Horário cheio some do site.

update yasfood.settings set min_lead_days = 0 where id = 1 and min_lead_days > 0;

alter table yasfood.delivery_windows add column if not exists max_orders int check (max_orders is null or max_orders > 0);

drop function if exists yasfood.available_windows(date, text);
create or replace function yasfood.available_windows(p_date date, p_fulfillment text default 'ambos')
returns table (id uuid, label text, start_time time, end_time time, min_lead_minutes int, applies_to text,
               bookable boolean, closes_at timestamp, max_orders int, booked int, remaining int)
language sql stable security definer set search_path = yasfood, public as $$
  with b as (
    select o.window_id, count(*)::int as n
    from yasfood.orders o
    where o.scheduled_date = p_date and o.status <> 'cancelado' and o.window_id is not null
    group by o.window_id
  )
  select w.id, w.label, w.start_time, w.end_time, w.min_lead_minutes, w.applies_to,
         (((p_date + w.start_time) - make_interval(mins => w.min_lead_minutes)) > yasfood.now_br()
            and (w.max_orders is null or coalesce(b.n, 0) < w.max_orders)) as bookable,
         ((p_date + w.start_time) - make_interval(mins => w.min_lead_minutes)) as closes_at,
         w.max_orders,
         coalesce(b.n, 0) as booked,
         case when w.max_orders is null then null else greatest(w.max_orders - coalesce(b.n, 0), 0) end as remaining
  from yasfood.delivery_windows w
  left join b on b.window_id = w.id
  where w.active
    and extract(dow from p_date)::int = any(w.weekdays)
    and (p_fulfillment = 'ambos' or w.applies_to = 'ambos' or w.applies_to = p_fulfillment)
  order by w.start_time, w.sort_order;
$$;
grant execute on function yasfood.available_windows(date, text) to anon, authenticated;

-- Dia bookável: vaga no dia e, se o dia tem horários cadastrados, pelo menos um ainda aberto (vale pra hoje).
create or replace function yasfood.availability(p_from date, p_to date)
returns table (day date, max_units int, is_open boolean, booked_units int, remaining int, bookable boolean)
language sql
stable
security definer
set search_path = yasfood, public
as $$
  with s as (select min_lead_days, is_open as store_open from yasfood.settings where id = 1),
  booked as (
    select o.scheduled_date, coalesce(sum(oi.qty), 0)::int as units
    from yasfood.orders o
    join yasfood.order_items oi on oi.order_id = o.id
    where o.status <> 'cancelado' and o.scheduled_date between p_from and p_to
    group by o.scheduled_date
  )
  select
    c.day,
    c.max_units,
    c.is_open,
    coalesce(b.units, 0) as booked_units,
    greatest(c.max_units - coalesce(b.units, 0), 0) as remaining,
    (c.is_open and s.store_open
      and c.day >= yasfood.today_br() + s.min_lead_days
      and (c.max_units - coalesce(b.units, 0)) > 0
      and (
        not exists (select 1 from yasfood.delivery_windows w where w.active and extract(dow from c.day)::int = any(w.weekdays))
        or exists (select 1 from yasfood.available_windows(c.day, 'ambos') aw where aw.bookable)
      )) as bookable
  from yasfood.capacity_days c
  cross join s
  left join booked b on b.scheduled_date = c.day
  where c.day between p_from and p_to
  order by c.day;
$$;
grant execute on function yasfood.availability(date, date) to anon, authenticated;
