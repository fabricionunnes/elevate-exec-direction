-- Categorias do cardápio (Bolos, Sem açúcar, Pães, Salgados, Biscoitos, Doces...), gerenciadas no painel.
-- O produto guarda o nome da categoria; renomear a categoria atualiza os produtos (on update cascade).
create table if not exists yasfood.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table yasfood.categories enable row level security;
drop policy if exists categories_public_read on yasfood.categories;
create policy categories_public_read on yasfood.categories for select using (active or yasfood.is_admin());
drop policy if exists categories_admin_all on yasfood.categories;
create policy categories_admin_all on yasfood.categories for all using (yasfood.is_admin()) with check (yasfood.is_admin());
grant select on yasfood.categories to anon;
grant select, insert, update, delete on yasfood.categories to authenticated;

-- Uma vez só: cria as categorias e encaixa os produtos que já existem.
-- Depois disso a Yasmim manda: o deploy não recria categoria apagada nem muda produto de lugar.
do $$
begin
  if not exists (select 1 from yasfood.seeds_aplicadas where key = 'categorias_v1') then
    insert into yasfood.categories (name, sort_order) values
      ('Bolos', 1), ('Sem açúcar', 2), ('Pães', 3), ('Salgados', 4), ('Biscoitos', 5), ('Doces', 6)
    on conflict (name) do nothing;

    update yasfood.products set category = case
      when name ilike '%0 açúcar%' or name ilike '%zero açúcar%' or name ilike '%zero açucar%'
        or name ilike '%sem açúcar%' or name ilike '%sem açucar%' or name ilike '%diet%' then 'Sem açúcar'
      when name ilike 'biscoito%' then 'Biscoitos'
      when name ilike 'pão%' or name ilike 'pao %' then 'Pães'
      when name ilike '%bolo%' or name ilike '%cupcake%' then 'Bolos'
      when name ilike '%salgad%' or name ilike '%coxinha%' or name ilike '%empada%' or name ilike '%quiche%' then 'Salgados'
      else coalesce(nullif(trim(category), ''), 'Doces')
    end;

    -- alguma categoria antiga digitada à mão que não está na lista vira categoria também
    insert into yasfood.categories (name, sort_order)
    select distinct p.category, 50 from yasfood.products p
    where not exists (select 1 from yasfood.categories c where c.name = p.category)
    on conflict (name) do nothing;

    insert into yasfood.seeds_aplicadas (key) values ('categorias_v1');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'products_category_fk') then
    alter table yasfood.products
      add constraint products_category_fk foreign key (category)
      references yasfood.categories (name) on update cascade on delete restrict;
  end if;
end $$;
