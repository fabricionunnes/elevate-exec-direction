-- Custo dos bolos vendidos (CMV): cada item de pedido x custo atual da receita do produto
create or replace view yasfood.order_item_costs as
select
  oi.id as order_item_id, oi.order_id, oi.product_id, oi.product_name, oi.qty, oi.line_total,
  o.scheduled_date, o.status, o.payment_status,
  coalesce(pc.cost, 0)::numeric(10,2) as unit_cost,
  (oi.qty * coalesce(pc.cost, 0))::numeric(10,2) as total_cost
from yasfood.order_items oi
join yasfood.orders o on o.id = oi.order_id
left join yasfood.product_costs pc on pc.product_id = oi.product_id;
alter view yasfood.order_item_costs set (security_invoker = on);
grant select on yasfood.order_item_costs to authenticated;
