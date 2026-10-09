-- Banners no topo do cardápio, com link pra um produto ou pra uma URL.
create table if not exists yasfood.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  subtitle text not null default '',
  image_url text not null,
  product_id uuid references yasfood.products(id) on delete set null,
  link_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now()
);

alter table yasfood.banners enable row level security;
drop policy if exists banners_public_read on yasfood.banners;
create policy banners_public_read on yasfood.banners for select
  using (yasfood.is_admin() or (active and (starts_at is null or starts_at <= yasfood.today_br()) and (ends_at is null or ends_at >= yasfood.today_br())));
drop policy if exists banners_admin_all on yasfood.banners;
create policy banners_admin_all on yasfood.banners for all using (yasfood.is_admin()) with check (yasfood.is_admin());

grant select on yasfood.banners to anon;
grant select, insert, update, delete on yasfood.banners to authenticated;
