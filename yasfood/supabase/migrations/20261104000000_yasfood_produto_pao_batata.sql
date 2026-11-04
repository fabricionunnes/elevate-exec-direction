-- Pão de Batata recheado com presunto e mussarela, kit com 4: entra uma vez só.
-- Se a Yasmim mexer ou apagar depois, o deploy não recria.
with marca as (
  insert into yasfood.seeds_aplicadas (key)
  select 'produto_pao_batata'
  where not exists (select 1 from yasfood.products where name ilike 'pão de batata%')
  on conflict (key) do nothing
  returning key
),
prod as (
  insert into yasfood.products (name, description, price, weight_g, image_url, category, active, sort_order)
  select 'Pão de Batata recheado (4 unidades)',
         'Kit com 4 pães de batata fofinhos, recheados com presunto e muita mussarela derretendo.',
         20, null, 'https://yasfood.unvholdings.workers.dev/produtos/pao-batata.jpg', 'Salgados', true, 50
  from marca
  returning id, image_url
)
insert into yasfood.product_media (product_id, kind, url, sort_order)
select id, 'image', image_url, 0 from prod;
