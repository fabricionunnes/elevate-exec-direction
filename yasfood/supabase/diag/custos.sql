-- Diagnóstico de custos (só leitura): sai no log do deploy pra conferir insumos, entradas e receitas.
select json_build_object(
  'insumos', (select json_agg(json_build_object('n', name, 'u', unit, 'q', qty_on_hand, 'c', cost_per_unit, 'p', pack_size) order by name) from yasfood.ingredients),
  'entradas', (select json_agg(json_build_object('i', i.name, 'q', m.qty, 'uc', m.unit_cost, 't', m.total_cost, 'n', m.note, 'at', m.created_at) order by m.created_at desc)
               from (select * from yasfood.stock_movements where type = 'entrada' order by created_at desc limit 40) m
               join yasfood.ingredients i on i.id = m.ingredient_id),
  'receitas', (select json_agg(json_build_object('p', p.name, 'i', i.name, 'q', pi.qty, 'c', round(pi.qty * i.cost_per_unit, 2)) order by p.name, i.name)
               from yasfood.product_ingredients pi join yasfood.products p on p.id = pi.product_id join yasfood.ingredients i on i.id = pi.ingredient_id),
  'produtos', (select json_agg(row_to_json(pc)) from yasfood.product_costs pc)
) as diag;
