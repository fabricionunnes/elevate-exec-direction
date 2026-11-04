-- Foto do Pão de Batata Recheado (servida pelo próprio site, em /produtos/).
-- Entra uma vez só: vira capa e primeira da galeria. Se a Yasmim trocar ou apagar depois, o deploy não mexe de novo.
with p as (
  select id from yasfood.products
  where name ilike 'pão de batata%'
  order by active desc, created_at
  limit 1
),
marca as (
  insert into yasfood.seeds_aplicadas (key)
  select 'foto_pao_batata' from p
  on conflict (key) do nothing
  returning key
),
ins as (
  insert into yasfood.product_media (product_id, kind, url, sort_order)
  select p.id, 'image', 'https://yasfood.unvholdings.workers.dev/produtos/pao-batata.jpg', -1
  from p, marca
  returning product_id, url
)
update yasfood.products pr set image_url = ins.url from ins where pr.id = ins.product_id;
