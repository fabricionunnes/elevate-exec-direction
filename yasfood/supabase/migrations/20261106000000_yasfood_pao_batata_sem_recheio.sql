-- Pão de Batata sem recheio, tamanho normal: kit de 4 por R$ 20, na categoria Pães.
-- Receita = a do pão recheado (kit de 4), sem a mussarela. O "mini sem recheio" da Yasmim não é tocado.
-- Uma vez só (seeds_aplicadas); não cria de novo se ela apagar, nem mexe em receita que já exista.
do $$
declare v_novo uuid; v_src uuid; v_cat text;
begin
  if exists (select 1 from yasfood.seeds_aplicadas where key = 'pao_batata_sem_recheio_v1') then return; end if;

  select coalesce((select name from yasfood.categories where name = 'Pães'),
                  (select category from yasfood.products where name ilike 'pão de batata%' order by created_at limit 1)) into v_cat;

  select id into v_novo from yasfood.products
  where name ilike 'pão de batata%sem recheio%' and name not ilike '%mini%'
  order by created_at limit 1;
  if v_novo is null then
    insert into yasfood.products (name, description, price, weight_g, image_url, category, active, sort_order)
    values ('Pão de Batata sem recheio',
            'Kit com 4 pães de batata fofinhos, sem recheio. Perfeito pro café da manhã e pro lanche.',
            20, null, null, v_cat, true, 0)
    returning id into v_novo;
  end if;

  select p.id into v_src from yasfood.products p
  where p.name ilike 'pão de batata%' and p.name ilike '%presunto%'
    and exists (select 1 from yasfood.product_ingredients pi where pi.product_id = p.id)
  order by p.created_at limit 1;

  if v_src is not null and not exists (select 1 from yasfood.product_ingredients where product_id = v_novo) then
    insert into yasfood.product_ingredients (product_id, ingredient_id, qty)
    select v_novo, pi.ingredient_id, pi.qty
    from yasfood.product_ingredients pi join yasfood.ingredients i on i.id = pi.ingredient_id
    where pi.product_id = v_src and i.name not ilike 'mu%arela%' and i.name not ilike '%presunto%';
  end if;

  insert into yasfood.seeds_aplicadas (key) values ('pao_batata_sem_recheio_v1');
end $$;
