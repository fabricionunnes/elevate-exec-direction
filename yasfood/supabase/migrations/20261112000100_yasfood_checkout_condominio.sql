-- Checkout sem "Qual condomínio / região?": o cliente digita o condomínio ou bairro e o endereço.
-- A região de frete passa a ser a padrão (primeira ativa); o pedido guarda o condomínio digitado em zone_name.
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
  v_auto_zone boolean := false;
begin
  -- site sem escolha de região: o cliente digita o condomínio/bairro; a região (frete) é a padrão
  if p->>'fulfillment' = 'entrega' and coalesce(p->>'zone_id', '') = '' then
    if length(trim(coalesce(p->>'bairro', ''))) < 2 then raise exception 'DADOS: informe o condomínio ou bairro'; end if;
    p := jsonb_set(p, '{zone_id}', to_jsonb((select id::text from yasfood.delivery_zones where active order by sort_order, name limit 1)));
    v_auto_zone := true;
  end if;
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

  -- no pedido aparece o condomínio que o cliente digitou (rota, painel e WhatsApp)
  if v_auto_zone then
    update yasfood.orders set zone_name = yasfood.nice_name(left(p->>'bairro', 80)) where id = v_order_id;
  end if;

  if length(trim(coalesce(p->>'bairro', ''))) >= 2 then
    update yasfood.customers set bairro = yasfood.nice_name(left(p->>'bairro', 80))
    where id = (select customer_id from yasfood.orders where id = v_order_id);
  end if;
  return r || jsonb_build_object('total', (select total from yasfood.orders where id = v_order_id), 'addons_total', v_sum);
end $$;
grant execute on function yasfood.place_order_with_addons(jsonb) to anon, authenticated;
