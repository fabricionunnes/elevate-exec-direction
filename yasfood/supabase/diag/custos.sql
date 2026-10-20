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
  'push_debug', (select json_agg(json_build_object('at', d.created_at, 'step', d.step, 'ok', d.ok, 'info', d.info) order by d.created_at desc)
                 from (select * from yasfood.push_debug order by created_at desc limit 25) d),
  'push_aparelhos', (select json_agg(json_build_object('device', device, 'criado', created_at, 'ultimo_ok', last_ok_at, 'falhas', fail_count)) from yasfood.push_subscriptions),
  'push_chave', (select count(*) from yasfood.push_keys),
  'movimentos', (select json_agg(json_build_object('i', i.name, 'tp', m.type, 'q', m.qty, 'uc', m.unit_cost, 'n', m.note, 'at', m.created_at) order by m.created_at desc)
                 from (select * from yasfood.stock_movements order by created_at desc limit 40) m
                 join yasfood.ingredients i on i.id = m.ingredient_id),
  'agenda_hoje', json_build_object(
    'agora', yasfood.now_br(), 'hoje', yasfood.today_br(), 'dow', extract(dow from yasfood.today_br()),
    'config', (select json_build_object('min_lead_days', min_lead_days, 'is_open', is_open, 'pickup', pickup_enabled) from yasfood.settings where id = 1),
    'dia', (select row_to_json(c) from yasfood.capacity_days c where c.day = yasfood.today_br()),
    'disp', (select json_agg(row_to_json(a)) from yasfood.availability(yasfood.today_br(), yasfood.today_br() + 1) a),
    'janelas_hoje', (select json_agg(row_to_json(w)) from yasfood.available_windows(yasfood.today_br(), 'ambos') w),
    'janelas', (select json_agg(json_build_object('label', label, 'ini', start_time, 'fim', end_time, 'lead', min_lead_minutes, 'dias', weekdays, 'tipo', applies_to, 'ativo', active, 'max', max_orders)) from yasfood.delivery_windows)),
  'foto_biscoito', (select json_agg(json_build_object('p', p.name, 'capa', p.image_url, 'fotos', (select count(*) from yasfood.product_media m where m.product_id = p.id)))
                    from yasfood.products p where p.name ilike '%biscoito%')
) as diag;
