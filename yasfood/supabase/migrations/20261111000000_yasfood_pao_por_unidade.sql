-- Pães por unidade com pedido mínimo
-- products.min_qty: o cliente pede a partir disso (pão de batata: mínimo 4, R$ 5 cada).
-- order_items.slots: quantas vagas da agenda o item ocupa = arredonda pra cima (qtd / mínimo).
--   Bolo (mínimo 1) continua 1 vaga por unidade; 4 pães = 1 vaga, 5 a 8 pães = 2 vagas.

alter table yasfood.products add column if not exists min_qty int not null default 1;
do $$ begin
  alter table yasfood.products add constraint products_min_qty_chk check (min_qty >= 1);
exception when duplicate_object then null; end $$;

alter table yasfood.order_items add column if not exists slots int;

create or replace function yasfood.item_slots(p_product_id uuid, p_qty int)
returns int
language sql
stable
security definer
set search_path = yasfood, public
as $$
  select ceil(greatest(coalesce(p_qty, 0), 0)::numeric
              / greatest(coalesce((select min_qty from yasfood.products where id = p_product_id), 1), 1))::int;
$$;

create or replace function yasfood.order_items_set_slots()
returns trigger
language plpgsql
as $$
begin
  new.slots := yasfood.item_slots(new.product_id, new.qty);
  return new;
end $$;

drop trigger if exists order_items_slots on yasfood.order_items;
create trigger order_items_slots before insert or update of qty, product_id on yasfood.order_items
  for each row execute function yasfood.order_items_set_slots();

-- uma vez só: pão de batata (kit de 4 por R$ 20) vira unidade de R$ 5, mínimo 4.
-- receita era por kit de 4 → divide por 4; pedidos antigos viram unidades (qtd x 4, preço / 4, mesmo total).
do $$
declare v_ids uuid[];
begin
  if exists (select 1 from yasfood.seeds_aplicadas where key = 'pao_por_unidade_v1') then return; end if;

  select coalesce(array_agg(id), '{}') into v_ids
  from yasfood.products
  where category = 'Pães' and name ilike 'pão de batata%' and price = 20 and min_qty = 1;

  if cardinality(v_ids) > 0 then
    update yasfood.products set price = 5, min_qty = 4 where id = any(v_ids);
    update yasfood.product_ingredients set qty = round(qty / 4, 3) where product_id = any(v_ids);
    update yasfood.order_items set qty = qty * 4, unit_price = round(unit_price / 4, 2) where product_id = any(v_ids);
  end if;

  insert into yasfood.seeds_aplicadas (key) values ('pao_por_unidade_v1');
end $$;

update yasfood.order_items set slots = yasfood.item_slots(product_id, qty) where slots is null;

-- capacidade do dia passa a contar vagas (slots) em vez de unidades
create or replace function yasfood.availability(p_from date, p_to date)
returns table (day date, max_units int, is_open boolean, booked_units int, remaining int, bookable boolean)
language sql
stable
security definer
set search_path = yasfood, public
as $$
  with s as (select min_lead_days, is_open as store_open from yasfood.settings where id = 1),
  booked as (
    select o.scheduled_date, coalesce(sum(coalesce(oi.slots, oi.qty)), 0)::int as units
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
    select o.scheduled_date, coalesce(sum(coalesce(oi.slots, oi.qty)), 0)::int as units
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
         coalesce((select sum(coalesce(oi.slots, oi.qty)) from yasfood.orders o join yasfood.order_items oi on oi.order_id = o.id
                   where o.scheduled_date = c.day and o.status <> 'cancelado'), 0)::int,
         coalesce(c.max_entregas, s.cap_entregas), c.max_entregas is null, yasfood.day_order_count(c.day, 'entrega'),
         coalesce(c.max_retiradas, s.cap_retiradas), c.max_retiradas is null, yasfood.day_order_count(c.day, 'retirada')
  from yasfood.capacity_days c cross join yasfood.settings s
  where s.id = 1 and c.day between p_from and p_to
  order by c.day;
end $$;
grant execute on function yasfood.agenda_capacity(date, date) to authenticated;

-- pedido do site: respeita o mínimo do produto e conta vagas (a Yasmim no painel pode passar)
create or replace function yasfood.place_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = yasfood, public
as $$
declare
  v_settings yasfood.settings%rowtype;
  v_cap yasfood.capacity_days%rowtype;
  v_phone text;
  v_name text;
  v_fulfillment text;
  v_zone yasfood.delivery_zones%rowtype;
  v_fee numeric(10,2) := 0;
  v_date date;
  v_items jsonb;
  v_item jsonb;
  v_product yasfood.products%rowtype;
  v_qty int;
  v_total_qty int := 0;
  v_items_total numeric(10,2) := 0;
  v_booked int;
  v_customer_id uuid;
  v_order_id uuid;
  v_code text;
  v_token uuid;
  v_payment text;
  v_admin boolean := yasfood.is_admin();   -- pedido manual da Yasmim: regras de prazo/limite não travam
  v_window record;
  v_window_id uuid;
  v_window_label text;
begin
  select * into v_settings from yasfood.settings where id = 1;
  if not v_settings.is_open and not v_admin then
    raise exception 'LOJA_FECHADA: %', v_settings.closed_message;
  end if;

  v_name := trim(coalesce(p->>'name', ''));
  v_phone := yasfood.normalize_phone(p->>'phone');
  if length(v_name) < 2 then raise exception 'DADOS: informe seu nome'; end if;
  if length(v_phone) < 10 then raise exception 'DADOS: informe um telefone válido com DDD'; end if;

  v_fulfillment := p->>'fulfillment';
  if v_fulfillment not in ('entrega','retirada') then raise exception 'DADOS: escolha entrega ou retirada'; end if;
  if v_fulfillment = 'retirada' and not v_settings.pickup_enabled then raise exception 'DADOS: retirada indisponível no momento'; end if;

  if v_fulfillment = 'entrega' then
    select * into v_zone from yasfood.delivery_zones where id = nullif(p->>'zone_id','')::uuid and active;
    if not found then raise exception 'ENTREGA: não entregamos nesse endereço'; end if;
    v_fee := v_zone.fee;
    if length(trim(coalesce(p->>'address',''))) < 3 then raise exception 'DADOS: informe o endereço (bloco/apto)'; end if;
  end if;

  v_payment := p->>'payment_method';
  if v_payment not in ('pix','dinheiro','cartao') then raise exception 'DADOS: escolha a forma de pagamento'; end if;

  v_date := nullif(p->>'scheduled_date','')::date;
  if v_date is null then raise exception 'DATA: escolha a data da encomenda'; end if;
  if v_date < yasfood.today_br() + v_settings.min_lead_days and not v_admin then
    raise exception 'DATA: pedidos precisam de pelo menos % dia(s) de antecedência', v_settings.min_lead_days;
  end if;
  if v_date < yasfood.today_br() then raise exception 'DATA: a data já passou'; end if;

  -- trava a linha do dia para evitar overbooking em pedidos simultâneos
  select * into v_cap from yasfood.capacity_days where day = v_date for update;
  if not found and v_admin then
    insert into yasfood.capacity_days (day, max_units, is_open) values (v_date, v_settings.default_daily_capacity, true)
    returning * into v_cap;
  end if;
  if not found or (not v_cap.is_open and not v_admin) then raise exception 'DATA: não estamos produzindo nesse dia'; end if;

  -- janela de horário (obrigatória quando existe janela cadastrada pro dia)
  v_window_id := nullif(p->>'window_id','')::uuid;
  if v_window_id is not null then
    select * into v_window from yasfood.available_windows(v_date, v_fulfillment) aw where aw.id = v_window_id;
    if not found then raise exception 'HORARIO: esse horário não está disponível nesse dia'; end if;
    if not v_window.bookable and not v_admin then
      raise exception 'HORARIO: o prazo pra pedir nesse horário já passou (até % antes). Escolha outro horário.',
        case when v_window.min_lead_minutes >= 60 then (v_window.min_lead_minutes/60)::text || 'h' else v_window.min_lead_minutes::text || ' min' end;
    end if;
    v_window_label := to_char(v_window.start_time, 'HH24:MI') || '–' || to_char(v_window.end_time, 'HH24:MI');
  elsif not v_admin and exists (select 1 from yasfood.available_windows(v_date, v_fulfillment)) then
    raise exception 'HORARIO: escolha um horário de %', case when v_fulfillment = 'entrega' then 'entrega' else 'retirada' end;
  end if;

  v_items := p->'items';
  if v_items is null or jsonb_array_length(v_items) = 0 then raise exception 'ITENS: seu carrinho está vazio'; end if;

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'ITENS: quantidade inválida'; end if;
    select * into v_product from yasfood.products where id = (v_item->>'product_id')::uuid and active;
    if not found then raise exception 'ITENS: produto indisponível'; end if;
    if v_qty < v_product.min_qty and not v_admin then
      raise exception 'ITENS: o pedido mínimo de "%" é % unidades', trim(v_product.name), v_product.min_qty;
    end if;
    v_total_qty := v_total_qty + yasfood.item_slots(v_product.id, v_qty);
    v_items_total := v_items_total + v_product.price * v_qty;
  end loop;

  select coalesce(sum(coalesce(oi.slots, oi.qty)), 0) into v_booked
  from yasfood.orders o join yasfood.order_items oi on oi.order_id = o.id
  where o.scheduled_date = v_date and o.status <> 'cancelado';

  if v_booked + v_total_qty > v_cap.max_units and not v_admin then
    raise exception 'CAPACIDADE: só temos % vaga(s) disponíveis para esse dia', greatest(v_cap.max_units - v_booked, 0);
  end if;

  -- cliente: cria ou atualiza pelo telefone
  insert into yasfood.customers (name, phone, zone_id, address, reference, kind)
  values (v_name, v_phone, case when v_fulfillment = 'entrega' then v_zone.id else null end,
          coalesce(p->>'address',''), coalesce(p->>'reference',''), 'cliente')
  on conflict (phone) do update
    set name = excluded.name,
        kind = 'cliente',
        zone_id = coalesce(excluded.zone_id, yasfood.customers.zone_id),
        address = case when excluded.address <> '' then excluded.address else yasfood.customers.address end,
        reference = case when excluded.reference <> '' then excluded.reference else yasfood.customers.reference end
  returning id into v_customer_id;

  insert into yasfood.orders (customer_id, customer_name, customer_phone, fulfillment, zone_id, zone_name, address, reference,
                             delivery_fee, scheduled_date, items_total, total, payment_method, change_for, notes, window_id, window_label)
  values (v_customer_id, v_name, v_phone, v_fulfillment,
          case when v_fulfillment = 'entrega' then v_zone.id else null end,
          case when v_fulfillment = 'entrega' then v_zone.name else null end,
          coalesce(p->>'address',''), coalesce(p->>'reference',''),
          v_fee, v_date, v_items_total, v_items_total + v_fee, v_payment,
          nullif(p->>'change_for','')::numeric, coalesce(p->>'notes',''), v_window_id, v_window_label)
  returning id, code, tracking_token into v_order_id, v_code, v_token;

  for v_item in select * from jsonb_array_elements(v_items) loop
    select * into v_product from yasfood.products where id = (v_item->>'product_id')::uuid;
    insert into yasfood.order_items (order_id, product_id, product_name, unit_price, qty, line_total)
    values (v_order_id, v_product.id, v_product.name, v_product.price, (v_item->>'qty')::int, v_product.price * (v_item->>'qty')::int);
  end loop;

  insert into yasfood.order_events (order_id, status, note) values (v_order_id, 'recebido', 'Pedido recebido. Aguardando confirmação.');

  return jsonb_build_object('order_id', v_order_id, 'code', v_code, 'tracking_token', v_token, 'total', v_items_total + v_fee);
end $$;
grant execute on function yasfood.place_order(jsonb) to anon, authenticated;
