-- Bolo de Caramelo Salgado (R$ 70) no cardápio, categoria Bolos, com a foto real da Yasmim.
-- Sem receita por enquanto (ela monta no painel). Uma vez só; não mexe se já existir.
do $$
declare v_prod uuid; v_cat text;
  v_foto text := 'https://yasfood.unvholdings.workers.dev/produtos/bolo-caramelo-salgado.jpg';
begin
  if exists (select 1 from yasfood.seeds_aplicadas where key = 'bolo_caramelo_salgado_v1') then return; end if;

  select coalesce((select name from yasfood.categories where name = 'Bolos'),
                  (select name from yasfood.categories order by sort_order, name limit 1)) into v_cat;

  select id into v_prod from yasfood.products where name ilike '%caramelo salgado%' order by created_at limit 1;
  if v_prod is null then
    insert into yasfood.products (name, description, price, weight_g, image_url, category, active, sort_order)
    values ('Bolo de Caramelo Salgado',
            'Bolo fofinho com cobertura cremosa de caramelo salgado, aquele equilíbrio perfeito entre o doce e o salgadinho.',
            70, null, v_foto, v_cat, true, 0)
    returning id into v_prod;
    insert into yasfood.product_media (product_id, kind, url, sort_order) values (v_prod, 'image', v_foto, 0);
  end if;

  insert into yasfood.seeds_aplicadas (key) values ('bolo_caramelo_salgado_v1');
end $$;
