-- Adicionais do pedido (ex.: vela, cartão, embalagem presente, cobertura extra), com preço que soma no total.
-- Não contam na vaga do dia (que é por bolo) e não mexem na receita/estoque.

create table if not exists yasfood.addons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0 check (price >= 0),
  max_qty int not null default 5 check (max_qty between 1 and 50),
  product_ids uuid[] not null default '{}',   -- vazio = vale pra qualquer pedido; senão só aparece com esses produtos no carrinho
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table yasfood.addons enable row level security;
drop policy if exists addons_public_read on yasfood.addons;
create policy addons_public_read on yasfood.addons for select using (active or yasfood.is_admin());
drop policy if exists addons_admin_all on yasfood.addons;
create policy addons_admin_all on yasfood.addons for all using (yasfood.is_admin()) with check (yasfood.is_admin());
grant select on yasfood.addons to anon;
grant select, insert, update, delete on yasfood.addons to authenticated;

create table if not exists yasfood.order_addons (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references yasfood.orders(id) on delete cascade,
  addon_id uuid references yasfood.addons(id) on delete set null,
  name text not null,
  unit_price numeric(10,2) not null,
  qty int not null check (qty > 0),
  line_total numeric(10,2) not null
);
create index if not exists order_addons_order_idx on yasfood.order_addons (order_id);
alter table yasfood.order_addons enable row level security;
drop policy if exists order_addons_admin_all on yasfood.order_addons;
create policy order_addons_admin_all on yasfood.order_addons for all using (yasfood.is_admin()) with check (yasfood.is_admin());
grant select, insert, update, delete on yasfood.order_addons to authenticated;

alter table yasfood.orders add column if not exists addons_total numeric(10,2) not null default 0;

-- Total do pedido sempre = itens + frete + adicionais (inclusive quando a Yasmim edita o pedido).
create or replace function yasfood.orders_total_with_addons()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT'
     or new.items_total is distinct from old.items_total
     or new.delivery_fee is distinct from old.delivery_fee
     or new.addons_total is distinct from old.addons_total
     or new.total is distinct from old.total then
    new.total := coalesce(new.items_total, 0) + coalesce(new.delivery_fee, 0) + coalesce(new.addons_total, 0);
  end if;
  return new;
end $$;
drop trigger if exists orders_total_with_addons on yasfood.orders;
create trigger orders_total_with_addons before insert or update on yasfood.orders
  for each row execute function yasfood.orders_total_with_addons();

-- Receita do pedido no Financeiro acompanha o total (com adicionais).
create or replace function yasfood.transactions_receita_total()
returns trigger
language plpgsql
as $$
declare v_total numeric(10,2);
begin
  if new.type = 'receita' and new.order_id is not null then
    select total into v_total from yasfood.orders where id = new.order_id;
    if v_total is not null then new.amount := v_total; end if;
  end if;
  return new;
end $$;
drop trigger if exists transactions_receita_total on yasfood.transactions;
create trigger transactions_receita_total before insert or update on yasfood.transactions
  for each row execute function yasfood.transactions_receita_total();

create or replace function yasfood.orders_sync_receita()
returns trigger
language plpgsql
as $$
begin
  if new.total is distinct from old.total then
    update yasfood.transactions set amount = new.total where order_id = new.id and type = 'receita';
  end if;
  return new;
end $$;
drop trigger if exists orders_sync_receita on yasfood.orders;
create trigger orders_sync_receita after update on yasfood.orders
  for each row execute function yasfood.orders_sync_receita();

-- Pedido com adicionais: chama o place_order (que valida tudo) e soma os adicionais na mesma transação.
-- payload igual ao place_order + addons: [{addon_id, qty}]
create or replace function yasfood.place_order_with_addons(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = yasfood, public
as $$
declare
  r jsonb;
  v_order_id uuid;
  v_a jsonb;
  v_addon yasfood.addons%rowtype;
  v_qty int;
  v_sum numeric(10,2) := 0;
  v_products uuid[];
begin
  -- cliente que já comprou e deixou o nome em branco: usa o nome do cadastro pelo telefone
  if length(trim(coalesce(p->>'name', ''))) < 2 then
    p := jsonb_set(p, '{name}', to_jsonb(coalesce((select c.name from yasfood.customers c where c.phone = yasfood.normalize_phone(p->>'phone')), '')));
  end if;
  r := yasfood.place_order(p);
  v_order_id := (r->>'order_id')::uuid;
  select coalesce(array_agg(distinct product_id), '{}') into v_products from yasfood.order_items where order_id = v_order_id;

  for v_a in select * from jsonb_array_elements(coalesce(p->'addons', '[]'::jsonb)) loop
    v_qty := coalesce((v_a->>'qty')::int, 0);
    continue when v_qty <= 0;
    select * into v_addon from yasfood.addons where id = (v_a->>'addon_id')::uuid and active;
    if not found then raise exception 'ITENS: um adicional não está mais disponível. Atualize a página.'; end if;
    if v_qty > v_addon.max_qty then raise exception 'ITENS: no máximo % de "%"', v_addon.max_qty, v_addon.name; end if;
    if cardinality(v_addon.product_ids) > 0 and not (v_addon.product_ids && v_products) then
      raise exception 'ITENS: o adicional "%" não vale pros itens do carrinho', v_addon.name;
    end if;
    insert into yasfood.order_addons (order_id, addon_id, name, unit_price, qty, line_total)
    values (v_order_id, v_addon.id, v_addon.name, v_addon.price, v_qty, v_addon.price * v_qty);
    v_sum := v_sum + v_addon.price * v_qty;
  end loop;

  if v_sum > 0 then
    update yasfood.orders set addons_total = v_sum where id = v_order_id;
  end if;
  return r || jsonb_build_object('total', (select total from yasfood.orders where id = v_order_id), 'addons_total', v_sum);
end $$;
grant execute on function yasfood.place_order_with_addons(jsonb) to anon, authenticated;

-- Rastreio do cliente passa a mostrar os adicionais
create or replace function yasfood.get_order_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = yasfood, public
as $$
  select jsonb_build_object(
    'order', to_jsonb(o) - 'customer_id' - 'stock_consumed',
    'items', (select coalesce(jsonb_agg(to_jsonb(oi) order by oi.product_name), '[]'::jsonb) from yasfood.order_items oi where oi.order_id = o.id),
    'addons', (select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'qty', a.qty, 'line_total', a.line_total) order by a.name), '[]'::jsonb) from yasfood.order_addons a where a.order_id = o.id),
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb) from yasfood.order_events e where e.order_id = o.id),
    'review', (select jsonb_build_object('rating', r.rating, 'comment', r.comment, 'reply', r.reply) from yasfood.reviews r where r.order_id = o.id),
    'settings', (select jsonb_build_object('business_name', s.business_name, 'whatsapp', s.whatsapp, 'pix_key', s.pix_key, 'pix_name', s.pix_name, 'pickup_address', s.pickup_address) from yasfood.settings s where s.id = 1)
  )
  from yasfood.orders o
  where o.tracking_token = p_token;
$$;
grant execute on function yasfood.get_order_by_token(uuid) to anon, authenticated;
