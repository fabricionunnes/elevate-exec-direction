-- Pão de batata só de mussarela: mesma receita do kit de 4 (a receita base é de mussarela).
-- Copia do pão de batata que já tem receita. Uma vez só e só se ele ainda estiver sem receita.
do $$
declare v_dest uuid; v_src uuid;
begin
  if exists (select 1 from yasfood.seeds_aplicadas where key = 'receita_pao_mussarela_v1') then return; end if;
  select id into v_dest from yasfood.products
  where name ilike 'pão de batata%' and name ilike '%mussarela%' and name not ilike '%presunto%'
  order by created_at limit 1;
  select p.id into v_src from yasfood.products p
  where p.name ilike 'pão de batata%' and p.id is distinct from v_dest
    and exists (select 1 from yasfood.product_ingredients pi where pi.product_id = p.id)
  order by p.created_at limit 1;
  if v_dest is not null and v_src is not null
     and not exists (select 1 from yasfood.product_ingredients where product_id = v_dest) then
    insert into yasfood.product_ingredients (product_id, ingredient_id, qty)
    select v_dest, ingredient_id, qty from yasfood.product_ingredients where product_id = v_src;
  end if;
  insert into yasfood.seeds_aplicadas (key) values ('receita_pao_mussarela_v1');
end $$;
