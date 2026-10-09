-- Permite corrigir pedidos já entregues (ex.: data lançada errada). Só cancelado fica travado.
create or replace function yasfood.admin_update_order(p_order_id uuid, p jsonb)
returns void
language plpgsql security definer set search_path = yasfood, public as $$
declare
  v_order yasfood.orders%rowtype;
  v_settings yasfood.settings%rowtype;
  v_fulfillment text;
  v_zone yasfood.delivery_zones%rowtype;
  v_fee numeric(10,2) := 0;
  v_date date;
  v_window record;
  v_window_id uuid;
  v_window_label text;
  v_items jsonb;
  v_item jsonb;
  v_product yasfood.products%rowtype;
  v_items_total numeric(10,2) := 0;
  v_payment text;
  v_phone text;
  v_name text;
  v_customer_id uuid;
  r record;
  v_changes text[] := '{}';
begin
  if not yasfood.is_admin() then raise exception 'sem permissão'; end if;
  select * into v_order from yasfood.orders where id = p_order_id for update;
  if not found then raise exception 'pedido não encontrado'; end if;
  -- entregue pode ser corrigido (data errada, item errado); cancelado não.
  if v_order.status = 'cancelado' then raise exception 'EDICAO: pedido cancelado não pode ser editado'; end if;
  select * into v_settings from yasfood.settings where id = 1;

  v_name := trim(coalesce(p->>'name', v_order.customer_name));
  v_phone := yasfood.normalize_phone(coalesce(p->>'phone', v_order.customer_phone));
  if length(v_name) < 2 then raise exception 'DADOS: informe o nome'; end if;
  if length(v_phone) < 10 then raise exception 'DADOS: telefone inválido'; end if;

  v_fulfillment := coalesce(p->>'fulfillment', v_order.fulfillment);
  if v_fulfillment not in ('entrega','retirada') then raise exception 'DADOS: entrega ou retirada'; end if;
  if v_fulfillment = 'entrega' then
    select * into v_zone from yasfood.delivery_zones where id = nullif(p->>'zone_id','')::uuid;
    if not found then raise exception 'ENTREGA: escolha a região de entrega'; end if;
    v_fee := v_zone.fee;
  end if;

  v_payment := coalesce(p->>'payment_method', v_order.payment_method);
  if v_payment not in ('pix','dinheiro','cartao') then raise exception 'DADOS: forma de pagamento inválida'; end if;

  v_date := coalesce(nullif(p->>'scheduled_date','')::date, v_order.scheduled_date);
  insert into yasfood.capacity_days (day, max_units, is_open) values (v_date, v_settings.default_daily_capacity, true) on conflict (day) do nothing;

  v_window_id := nullif(p->>'window_id','')::uuid;
  if v_window_id is not null then
    select w.start_time, w.end_time into v_window from yasfood.delivery_windows w where w.id = v_window_id;
    if not found then raise exception 'HORARIO: horário inválido'; end if;
    v_window_label := to_char(v_window.start_time, 'HH24:MI') || '–' || to_char(v_window.end_time, 'HH24:MI');
  end if;

  v_items := p->'items';
  if v_items is null or jsonb_array_length(v_items) = 0 then raise exception 'ITENS: o pedido precisa de pelo menos um item'; end if;
  for v_item in select * from jsonb_array_elements(v_items) loop
    if (v_item->>'qty')::int <= 0 then continue; end if;
    select * into v_product from yasfood.products where id = (v_item->>'product_id')::uuid;
    if not found then raise exception 'ITENS: produto inválido'; end if;
    v_items_total := v_items_total + v_product.price * (v_item->>'qty')::int;
  end loop;
  if v_items_total = 0 then raise exception 'ITENS: o pedido precisa de pelo menos um item'; end if;

  -- cliente (telefone é a chave)
  insert into yasfood.customers (name, phone, zone_id, address, reference, kind)
  values (v_name, v_phone, case when v_fulfillment = 'entrega' then v_zone.id else null end, coalesce(p->>'address',''), coalesce(p->>'reference',''), 'cliente')
  on conflict (phone) do update set name = excluded.name, kind = 'cliente',
    zone_id = coalesce(excluded.zone_id, yasfood.customers.zone_id),
    address = case when excluded.address <> '' then excluded.address else yasfood.customers.address end,
    reference = case when excluded.reference <> '' then excluded.reference else yasfood.customers.reference end
  returning id into v_customer_id;

  -- o que mudou (pra linha do tempo)
  if v_fulfillment <> v_order.fulfillment then v_changes := v_changes || (case when v_fulfillment = 'entrega' then 'passou pra entrega' else 'passou pra retirada' end); end if;
  if v_date <> v_order.scheduled_date then v_changes := v_changes || ('data: ' || to_char(v_date, 'DD/MM')); end if;
  if coalesce(v_window_label,'') <> coalesce(v_order.window_label,'') then v_changes := v_changes || ('horário: ' || coalesce(v_window_label, 'a combinar')); end if;
  if v_payment <> v_order.payment_method then v_changes := v_changes || ('pagamento: ' || v_payment); end if;

  -- estoque: se já tinha baixado, devolve e baixa de novo com os itens novos
  if v_order.stock_consumed then
    insert into yasfood.stock_movements (ingredient_id, type, qty, note, order_id)
    select ingredient_id, 'ajuste', -qty, 'Estorno por edição do pedido ' || v_order.code, p_order_id
    from yasfood.stock_movements where order_id = p_order_id and type = 'producao';
  end if;

  delete from yasfood.order_items where order_id = p_order_id;
  for v_item in select * from jsonb_array_elements(v_items) loop
    if (v_item->>'qty')::int <= 0 then continue; end if;
    select * into v_product from yasfood.products where id = (v_item->>'product_id')::uuid;
    insert into yasfood.order_items (order_id, product_id, product_name, unit_price, qty, line_total)
    values (p_order_id, v_product.id, v_product.name, v_product.price, (v_item->>'qty')::int, v_product.price * (v_item->>'qty')::int);
  end loop;

  if v_order.stock_consumed then
    for r in
      select pi.ingredient_id, sum(pi.qty * oi.qty) as qty
      from yasfood.order_items oi join yasfood.product_ingredients pi on pi.product_id = oi.product_id
      where oi.order_id = p_order_id group by pi.ingredient_id
    loop
      insert into yasfood.stock_movements (ingredient_id, type, qty, note, order_id)
      values (r.ingredient_id, 'producao', -r.qty, 'Produção do pedido ' || v_order.code || ' (editado)', p_order_id);
    end loop;
  end if;

  if v_items_total + v_fee <> v_order.total then v_changes := v_changes || ('total: R$ ' || to_char(v_items_total + v_fee, 'FM999G990D00')); end if;

  update yasfood.orders set
    customer_id = v_customer_id, customer_name = v_name, customer_phone = v_phone,
    fulfillment = v_fulfillment,
    zone_id = case when v_fulfillment = 'entrega' then v_zone.id else null end,
    zone_name = case when v_fulfillment = 'entrega' then v_zone.name else null end,
    address = coalesce(p->>'address',''), reference = coalesce(p->>'reference',''),
    delivery_fee = v_fee, scheduled_date = v_date, window_id = v_window_id, window_label = v_window_label,
    items_total = v_items_total, total = v_items_total + v_fee,
    payment_method = v_payment, change_for = nullif(p->>'change_for','')::numeric,
    notes = coalesce(p->>'notes', notes)
  where id = p_order_id;

  -- receita já lançada acompanha o total novo
  if v_order.payment_status = 'pago' then
    update yasfood.transactions set amount = v_items_total + v_fee where order_id = p_order_id and type = 'receita';
  end if;

  insert into yasfood.order_events (order_id, status, note)
  values (p_order_id, v_order.status, 'Pedido ajustado pela Yasmim' || case when array_length(v_changes,1) > 0 then ' (' || array_to_string(v_changes, ', ') || ')' else '' end || '.');
end $$;
revoke execute on function yasfood.admin_update_order(uuid, jsonb) from public, anon;
grant execute on function yasfood.admin_update_order(uuid, jsonb) to authenticated;
