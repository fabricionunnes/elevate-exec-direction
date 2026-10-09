-- Compras: onde comprou + lista de compras (automática pelo estoque/pedidos e itens manuais)
alter table yasfood.stock_movements add column if not exists supplier text not null default '';

create table if not exists yasfood.shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  qty_text text not null default '',         -- ex.: "2 pacotes", "1 dúzia"
  note text not null default '',
  ingredient_id uuid references yasfood.ingredients(id) on delete set null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table yasfood.shopping_items enable row level security;
drop policy if exists shopping_items_admin_all on yasfood.shopping_items;
create policy shopping_items_admin_all on yasfood.shopping_items for all using (yasfood.is_admin()) with check (yasfood.is_admin());
grant select, insert, update, delete on yasfood.shopping_items to authenticated;

-- Necessidade de insumos: estoque atual x mínimo x consumo dos pedidos abertos dos próximos 14 dias
create or replace view yasfood.ingredient_needs as
with upcoming as (
  select pi.ingredient_id, sum(pi.qty * oi.qty) as needed
  from yasfood.orders o
  join yasfood.order_items oi on oi.order_id = o.id
  join yasfood.product_ingredients pi on pi.product_id = oi.product_id
  where o.status in ('recebido','confirmado')          -- ainda não baixou estoque
    and o.scheduled_date between yasfood.today_br() and yasfood.today_br() + 14
  group by pi.ingredient_id
)
select
  i.id as ingredient_id,
  i.name, i.unit, i.qty_on_hand, i.min_qty, i.pack_size, i.pack_label, i.supplier, i.cost_per_unit,
  coalesce(u.needed, 0)::numeric(12,3) as needed_14d,
  greatest(coalesce(u.needed, 0) + i.min_qty - i.qty_on_hand, 0)::numeric(12,3) as shortage,
  case when i.pack_size is not null and i.pack_size > 0
       then ceil(greatest(coalesce(u.needed, 0) + i.min_qty - i.qty_on_hand, 0) / i.pack_size)::int
       else null end as packs_to_buy
from yasfood.ingredients i
left join upcoming u on u.ingredient_id = i.id
where i.active;
alter view yasfood.ingredient_needs set (security_invoker = on);
grant select on yasfood.ingredient_needs to authenticated;
