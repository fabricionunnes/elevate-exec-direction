-- Diagnóstico de custos (só leitura): sai no log do deploy pra conferir insumos, entradas e receitas.
select json_build_object(
  'insumos', (select json_agg(json_build_object('n', name, 'u', unit, 'q', qty_on_hand, 'c', cost_per_unit, 'p', pack_size) order by name) from yasfood.ingredients),
  'entradas', (select json_agg(json_build_object('i', i.name, 'q', m.qty, 'uc', m.unit_cost, 't', m.total_cost, 'n', m.note, 'at', m.created_at) order by m.created_at desc)
               from (select * from yasfood.stock_movements where type = 'entrada' order by created_at desc limit 40) m
               join yasfood.ingredients i on i.id = m.ingredient_id),
  'receitas', (select json_agg(json_build_object('p', p.name, 'i', i.name, 'q', pi.qty, 'c', round(pi.qty * i.cost_per_unit, 2)) order by p.name, i.name)
               from yasfood.product_ingredients pi join yasfood.products p on p.id = pi.product_id join yasfood.ingredients i on i.id = pi.ingredient_id),
  'produtos', (select json_agg(row_to_json(pc)) from yasfood.product_costs pc),
  'clientes_duplicados', (select json_agg(json_build_object('n', c.name, 'tel', right(c.phone, 4), 'len', length(c.phone), 'kind', c.kind, 'pedidos', (select count(*) from yasfood.orders o where o.customer_id = c.id), 'criado', c.created_at) order by c.name)
                          from yasfood.customers c
                          where lower(c.name) like 'camila%' or lower(c.name) like 'fl_via%'
                             or exists (select 1 from yasfood.customers d where d.id <> c.id and right(regexp_replace(d.phone, '\D', '', 'g'), 8) = right(regexp_replace(c.phone, '\D', '', 'g'), 8))),
  'pedidos_sem_cliente', (select json_agg(json_build_object('code', o.code, 'n', o.customer_name, 'tel', right(o.customer_phone, 4), 'len', length(o.customer_phone), 'st', o.status) order by o.created_at)
                          from yasfood.orders o where o.customer_id is null or not exists (select 1 from yasfood.customers c where c.id = o.customer_id)),
  'movimentos', (select json_agg(json_build_object('i', i.name, 'tp', m.type, 'q', m.qty, 'uc', m.unit_cost, 'n', m.note, 'at', m.created_at) order by m.created_at desc)
                 from (select * from yasfood.stock_movements order by created_at desc limit 40) m
                 join yasfood.ingredients i on i.id = m.ingredient_id)
) as diag;
