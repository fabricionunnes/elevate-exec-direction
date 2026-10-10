-- Nota de compra lida com "1 kg" como 1 g (ou "1 L" como 1 ml): a entrada no estoque ficou
-- mil vezes menor e o custo por g/ml mil vezes maior, o que estourou o custo do bolo no
-- Financeiro (R$ 23 mil de custo em 21 bolos). Corrige as entradas e o custo dos insumos.

create temp table cost_fix as
select m.id, m.ingredient_id, m.qty as old_qty, m.unit_cost as old_cost, m.created_at
from yasfood.stock_movements m
join yasfood.ingredients i on i.id = m.ingredient_id
where m.type = 'entrada'
  and i.unit in ('g', 'ml')
  and m.unit_cost is not null and m.unit_cost > 0.5   -- mais de R$ 500 o quilo/litro: erro de unidade
  and m.qty > 0 and m.qty < 50;                       -- entrou "2 g" em vez de 2.000 g

update yasfood.stock_movements m
set qty = m.qty * 1000, unit_cost = m.unit_cost / 1000
from cost_fix f
where m.id = f.id;

-- saldo: soma o que faltou entrar; custo: o da última entrada corrigida
update yasfood.ingredients i
set qty_on_hand = i.qty_on_hand + f.add_qty,
    cost_per_unit = f.new_cost
from (
  select ingredient_id,
         sum(old_qty) * 999 as add_qty,
         (array_agg(old_cost / 1000 order by created_at desc))[1] as new_cost
  from cost_fix
  group by ingredient_id
) f
where i.id = f.ingredient_id;

drop table cost_fix;
