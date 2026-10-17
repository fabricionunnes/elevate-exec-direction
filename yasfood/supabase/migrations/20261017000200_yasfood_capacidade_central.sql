-- Capacidade num lugar só (Agenda): bolos, entregas e retiradas por dia, com padrão e ajuste por dia.
-- E o horário passa a fechar pelo FIM (fim - antecedência): "Tarde 14h–17h, 2h antes" aceita pedido até 15h.

-- padrão (vazio = sem limite)
alter table yasfood.settings add column if not exists cap_entregas int check (cap_entregas is null or cap_entregas >= 0);
alter table yasfood.settings add column if not exists cap_retiradas int check (cap_retiradas is null or cap_retiradas >= 0);
-- ajuste do dia (vazio = usa o padrão)
alter table yasfood.capacity_days add column if not exists max_entregas int check (max_entregas is null or max_entregas >= 0);
alter table yasfood.capacity_days add column if not exists max_retiradas int check (max_retiradas is null or max_retiradas >= 0);

-- limite de pedidos do dia pra entrega ou retirada (null = sem limite)
create or replace function yasfood.day_order_limit(p_day date, p_fulfillment text)
returns int
language sql
stable
security definer
set search_path = yasfood, public
as $$
  select case p_fulfillment
           when 'entrega' then coalesce(c.max_entregas, s.cap_entregas)
           when 'retirada' then coalesce(c.max_retiradas, s.cap_retiradas)
         end
  from yasfood.settings s
  left join yasfood.capacity_days c on c.day = p_day
  where s.id = 1
$$;

create or replace function yasfood.day_order_count(p_day date, p_fulfillment text)
returns int
language sql
stable
security definer
set search_path = yasfood, public
as $$
  select count(*)::int from yasfood.orders
  where scheduled_date = p_day and fulfillment = p_fulfillment and status <> 'cancelado'
$$;

-- horários: fecha pelo fim do horário e some quando o dia já lotou de entregas/retiradas
create or replace function yasfood.available_windows(p_date date, p_fulfillment text default 'ambos')
returns table (id uuid, label text, start_time time, end_time time, min_lead_minutes int, applies_to text,
               bookable boolean, closes_at timestamp, max_orders int, booked int, remaining int)
language sql stable security definer set search_path = yasfood, public as $$
  with b as (
    select o.window_id, count(*)::int as n
    from yasfood.orders o
    where o.scheduled_date = p_date and o.status <> 'cancelado' and o.window_id is not null
    group by o.window_id
  ),
  dia as (
    select (lim is null or yasfood.day_order_count(p_date, p_fulfillment) < lim) as tem_vaga
    from (select yasfood.day_order_limit(p_date, p_fulfillment) as lim) x
  )
  select w.id, w.label, w.start_time, w.end_time, w.min_lead_minutes, w.applies_to,
         (((p_date + w.end_time) - make_interval(mins => w.min_lead_minutes)) > yasfood.now_br()
            and (w.max_orders is null or coalesce(b.n, 0) < w.max_orders)
            and (p_fulfillment = 'ambos' or (select tem_vaga from dia))) as bookable,
         ((p_date + w.end_time) - make_interval(mins => w.min_lead_minutes)) as closes_at,
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

-- dias com vaga pra entrega ou pra retirada (o site usa essa)
create or replace function yasfood.availability_for(p_from date, p_to date, p_fulfillment text)
returns table (day date, max_units int, is_open boolean, booked_units int, remaining int, bookable boolean,
               order_limit int, orders_booked int, orders_remaining int)
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
  ),
  d as (
    select c.*, coalesce(b.units, 0) as units, s.min_lead_days, s.store_open,
           yasfood.day_order_limit(c.day, p_fulfillment) as lim,
           yasfood.day_order_count(c.day, p_fulfillment) as cnt
    from yasfood.capacity_days c cross join s
    left join booked b on b.scheduled_date = c.day
    where c.day between p_from and p_to
  )
  select d.day, d.max_units, d.is_open, d.units, greatest(d.max_units - d.units, 0),
    (d.is_open and d.store_open
      and d.day >= yasfood.today_br() + d.min_lead_days
      and (d.max_units - d.units) > 0
      and (d.lim is null or d.cnt < d.lim)
      and (
        not exists (select 1 from yasfood.delivery_windows w where w.active and extract(dow from d.day)::int = any(w.weekdays)
                      and (w.applies_to = 'ambos' or w.applies_to = p_fulfillment))
        or exists (select 1 from yasfood.available_windows(d.day, p_fulfillment) aw where aw.bookable)
      )),
    d.lim, d.cnt, case when d.lim is null then null else greatest(d.lim - d.cnt, 0) end
  from d
  order by d.day;
$$;
grant execute on function yasfood.availability_for(date, date, text) to anon, authenticated;

-- Agenda do painel: tudo do dia numa linha
create or replace function yasfood.agenda_capacity(p_from date, p_to date)
returns table (day date, is_open boolean, max_units int, booked_units int,
               max_entregas int, entregas_padrao boolean, entregas int,
               max_retiradas int, retiradas_padrao boolean, retiradas int)
language plpgsql
stable
security definer
set search_path = yasfood, public
as $$
begin
  if not yasfood.is_admin() then raise exception 'Só a administradora'; end if;
  return query
  select c.day, c.is_open, c.max_units,
         coalesce((select sum(oi.qty) from yasfood.orders o join yasfood.order_items oi on oi.order_id = o.id
                   where o.scheduled_date = c.day and o.status <> 'cancelado'), 0)::int,
         coalesce(c.max_entregas, s.cap_entregas), c.max_entregas is null, yasfood.day_order_count(c.day, 'entrega'),
         coalesce(c.max_retiradas, s.cap_retiradas), c.max_retiradas is null, yasfood.day_order_count(c.day, 'retirada')
  from yasfood.capacity_days c cross join yasfood.settings s
  where s.id = 1 and c.day between p_from and p_to
  order by c.day;
end $$;
grant execute on function yasfood.agenda_capacity(date, date) to authenticated;

-- Trava no pedido do site: dia lotado de entregas/retiradas (a Yasmim no painel pode passar do limite)
create or replace function yasfood.orders_check_day_limit()
returns trigger
language plpgsql
security definer
set search_path = yasfood, public
as $$
declare v_lim int;
begin
  if yasfood.is_admin() then return new; end if;
  v_lim := yasfood.day_order_limit(new.scheduled_date, new.fulfillment);
  if v_lim is not null and yasfood.day_order_count(new.scheduled_date, new.fulfillment) >= v_lim then
    raise exception 'DATA: as % desse dia já estão completas. Escolha outra data%.',
      case when new.fulfillment = 'entrega' then 'entregas' else 'retiradas' end,
      case when new.fulfillment = 'entrega' then ' ou retire no local' else '' end;
  end if;
  return new;
end $$;
drop trigger if exists orders_check_day_limit on yasfood.orders;
create trigger orders_check_day_limit before insert on yasfood.orders
  for each row execute function yasfood.orders_check_day_limit();
