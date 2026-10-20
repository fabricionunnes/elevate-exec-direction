-- Foto nova do Biscoito de Cebola (servida pelo próprio site, em /produtos/).
-- Entra uma vez só: vira capa e primeira da galeria. Se a Yasmim trocar ou apagar depois, o deploy não mexe de novo.
create table if not exists yasfood.seeds_aplicadas (
  key text primary key,
  applied_at timestamptz not null default now()
);
alter table yasfood.seeds_aplicadas enable row level security;

with p as (
  select id from yasfood.products
  where name ilike '%biscoito%cebola%'
  order by active desc, created_at
  limit 1
),
marca as (
  insert into yasfood.seeds_aplicadas (key)
  select 'foto_biscoito_cebola_3' from p
  on conflict (key) do nothing
  returning key
),
ins as (
  insert into yasfood.product_media (product_id, kind, url, sort_order)
  select p.id, 'image', 'https://yasfood.unvholdings.workers.dev/produtos/biscoito-cebola-3.jpg', -1
  from p, marca
  returning product_id, url
)
update yasfood.products pr set image_url = ins.url from ins where pr.id = ins.product_id;
