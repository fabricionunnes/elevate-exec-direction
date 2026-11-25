-- Sobremesas de R$ 99 no pote redondo: mousse de maracujá, mousse de limão, mousse de chocolate e danoninho de morango.
-- Categoria nova "Sobremesas" (logo depois de Bolos). Sem receita por enquanto (a Yasmim monta no painel).
-- Uma vez só; não recria produto que já existir com o mesmo nome.
do $$
declare
  v_prod uuid; r record; v_ordem int;
  v_base text := 'https://yasfood.unvholdings.workers.dev/produtos/';
begin
  if exists (select 1 from yasfood.seeds_aplicadas where key = 'sobremesas_99_v1') then return; end if;

  if not exists (select 1 from yasfood.categories where name = 'Sobremesas') then
    select coalesce((select sort_order from yasfood.categories where name = 'Bolos'), 0) + 1 into v_ordem;
    update yasfood.categories set sort_order = sort_order + 1 where sort_order >= v_ordem;
    insert into yasfood.categories (name, sort_order, active) values ('Sobremesas', v_ordem, true);
  end if;

  for r in select * from (values
    ('Mousse de Maracujá', 'Mousse de maracujá aerada e cremosa, finalizada com polpa de maracujá por cima. Pote redondo.', 'mousse-maracuja.jpg', 0),
    ('Mousse de Limão', 'Mousse de limão leve e refrescante, finalizada com raspas de limão. Pote redondo.', 'mousse-limao.jpg', 1),
    ('Mousse de Chocolate', 'Mousse de chocolate cremosa, coberta de granulado gourmet. Pote redondo.', 'mousse-chocolate.jpg', 2),
    ('Danoninho de Morango', 'Creme de morango tipo danoninho, caseiro, decorado com morango fresco por cima. Pote redondo.', 'danoninho-morango.jpg', 3)
  ) as t(nome, descr, foto, ordem) loop
    select id into v_prod from yasfood.products where name ilike r.nome order by created_at limit 1;
    if v_prod is null then
      insert into yasfood.products (name, description, price, weight_g, image_url, category, active, sort_order)
      values (r.nome, r.descr, 99, null, v_base || r.foto, 'Sobremesas', true, r.ordem)
      returning id into v_prod;
      insert into yasfood.product_media (product_id, kind, url, sort_order) values (v_prod, 'image', v_base || r.foto, 0);
    end if;
  end loop;

  insert into yasfood.seeds_aplicadas (key) values ('sobremesas_99_v1');
end $$;
