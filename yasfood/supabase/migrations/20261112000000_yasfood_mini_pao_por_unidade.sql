-- Mini pão de batata por unidade: pacote de 8 por R$ 20 vira R$ 2,50 cada, mínimo 8.
-- Mesma regra do pão grande (20261111000000): 8 minis = 1 vaga na agenda; pedidos antigos viram unidades com o mesmo total.
do $$
declare v_ids uuid[];
begin
  if exists (select 1 from yasfood.seeds_aplicadas where key = 'mini_pao_por_unidade_v1') then return; end if;

  select coalesce(array_agg(id), '{}') into v_ids
  from yasfood.products
  where category = 'Pães' and name ilike 'mini p%o de batata%' and price = 20 and min_qty = 1;

  if cardinality(v_ids) > 0 then
    update yasfood.products set price = 2.50, min_qty = 8 where id = any(v_ids);
    update yasfood.product_ingredients set qty = round(qty / 8, 3) where product_id = any(v_ids);
    update yasfood.order_items set qty = qty * 8, unit_price = round(unit_price / 8, 2) where product_id = any(v_ids);
  end if;

  insert into yasfood.seeds_aplicadas (key) values ('mini_pao_por_unidade_v1');
end $$;
