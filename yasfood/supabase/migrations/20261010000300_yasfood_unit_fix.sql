-- Custo do bolo estourado (R$ 970 por bolo): o insumo "Óleo" estava em litros, com custo
-- R$ 7,99 por litro, e a receita usa 120 (ml). 120 × 7,99 = R$ 958 por bolo.
-- Volta o óleo pra ml (900 ml a garrafa, custo por ml), corrige a entrada da nota e o saldo.
-- Leite condensado estava marcado como "un" mas os números são em gramas (lata de 395 g).

-- 1) Óleo: litros → ml (saldo soma o que faltou entrar: 0,9 virou 900)
update yasfood.ingredients i
set unit = 'ml',
    pack_label = 'garrafa',
    pack_size = case when i.pack_size is not null and i.pack_size < 20 then i.pack_size * 1000 else i.pack_size end,
    cost_per_unit = case when i.cost_per_unit > 0.5 then i.cost_per_unit / 1000 else i.cost_per_unit end,
    qty_on_hand = i.qty_on_hand + coalesce((
      select sum(m.qty * 999) from yasfood.stock_movements m
      where m.ingredient_id = i.id and m.type = 'entrada' and m.qty > 0 and m.qty < 20
    ), 0)
where i.name = 'Óleo' and i.unit = 'l';

-- 2) a entrada da nota em litros vira ml
update yasfood.stock_movements m
set qty = m.qty * 1000, unit_cost = m.unit_cost / 1000
from yasfood.ingredients i
where i.id = m.ingredient_id and i.name = 'Óleo' and i.unit = 'ml'
  and m.type = 'entrada' and m.qty > 0 and m.qty < 20;

-- 3) Leite condensado: a unidade é grama (lata de 395 g), não "unidade"
update yasfood.ingredients
set unit = 'g', pack_label = 'lata'
where name = 'Leite condensado' and unit = 'un' and coalesce(pack_size, 0) >= 100;
