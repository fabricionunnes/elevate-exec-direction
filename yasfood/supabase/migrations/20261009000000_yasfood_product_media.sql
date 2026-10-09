-- Galeria por produto: várias fotos e vídeos. products.image_url continua sendo a capa.
create table if not exists yasfood.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references yasfood.products(id) on delete cascade,
  kind text not null check (kind in ('image','video')),
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_media_product_idx on yasfood.product_media (product_id, sort_order);

alter table yasfood.product_media enable row level security;
drop policy if exists product_media_public_read on yasfood.product_media;
create policy product_media_public_read on yasfood.product_media for select
  using (exists (select 1 from yasfood.products p where p.id = product_id and (p.active or yasfood.is_admin())));
drop policy if exists product_media_admin_all on yasfood.product_media;
create policy product_media_admin_all on yasfood.product_media for all using (yasfood.is_admin()) with check (yasfood.is_admin());

grant select on yasfood.product_media to anon;
grant select, insert, update, delete on yasfood.product_media to authenticated;

-- Vídeos: permitir arquivos maiores no bucket (50 MB) e só mídia
update storage.buckets set file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','video/mp4','video/quicktime','video/webm']
where id = 'produtos';
