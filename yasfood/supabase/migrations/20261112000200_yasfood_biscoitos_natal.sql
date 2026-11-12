-- Biscoitos de Natal: pacote de 10 (R$ 20) e pacote de 20 (R$ 35).
-- Receita base rende 20 biscoitos: o pacote de 20 leva a receita inteira, o de 10 leva a metade.
-- Insumo que não existe é criado com custo estimado de mercado; a Yasmim corrige ao lançar a nota.
-- Roda uma vez só (seeds_aplicadas); não mexe em produto ou receita que ela já tiver montado no painel.
create or replace function pg_temp.insumo(p_like text, p_nome text, p_unit text, p_custo numeric)
returns uuid language plpgsql as $$
declare v uuid;
begin
  select id into v from yasfood.ingredients
  where name ilike p_like and unit = p_unit
  order by active desc, created_at limit 1;
  if v is null then
    insert into yasfood.ingredients (name, unit, cost_per_unit) values (p_nome, p_unit, p_custo) returning id into v;
  end if;
  return v;
end $$;

create or replace function pg_temp.receita(p_prod uuid, p_ing uuid, p_qty numeric)
returns void language sql as $$
  insert into yasfood.product_ingredients (product_id, ingredient_id, qty) values (p_prod, p_ing, p_qty)
  on conflict (product_id, ingredient_id) do update set qty = yasfood.product_ingredients.qty + excluded.qty;
$$;

do $$
declare
  v_cat text; v_prod uuid; v_n int; v_f numeric;
  v_marg uuid; v_acucar uuid; v_ovo uuid; v_baun uuid; v_farinha uuid; v_cacau uuid; v_amido uuid;
  v_foto text := 'https://yasfood.unvholdings.workers.dev/produtos/biscoitos-natal-mesa.jpg';  -- capa
  v_real text := 'https://yasfood.unvholdings.workers.dev/produtos/biscoitos-natal.jpg';       -- travessa real
begin
  if exists (select 1 from yasfood.seeds_aplicadas where key = 'biscoitos_natal_v1') then return; end if;

  select coalesce((select name from yasfood.categories where name = 'Biscoitos'),
                  (select name from yasfood.categories order by sort_order, name limit 1)) into v_cat;

  v_marg    := pg_temp.insumo('MARG DELICIA%', 'Margarina Delícia com sal', 'g', 0.0093);
  v_acucar  := pg_temp.insumo('açúcar', 'Açúcar', 'g', 0.0035);
  v_ovo     := pg_temp.insumo('ovos', 'Ovos', 'un', 0.65);
  v_baun    := pg_temp.insumo('ESS%BAUN%', 'Essência de baunilha', 'ml', 0.38);
  v_farinha := pg_temp.insumo('farinha de trigo', 'Farinha de trigo', 'g', 0.0044);
  v_cacau   := pg_temp.insumo('CACAU PO%', 'Cacau em pó 100%', 'g', 0.05);
  v_amido   := pg_temp.insumo('amido de milho%', 'Amido de milho', 'g', 0.016);

  foreach v_n in array array[10, 20] loop
    v_f := v_n / 20.0;
    select id into v_prod from yasfood.products where name ilike 'biscoitos de natal%' || v_n || '%' order by created_at limit 1;
    if v_prod is null then
      insert into yasfood.products (name, description, price, weight_g, image_url, category, active, sort_order)
      values ('Biscoitos de Natal · ' || v_n || ' unidades',
              'Biscoitos amanteigados de baunilha e chocolate com carinha de Natal: ovelhinha, menino Jesus, sino, presente, anjinho e estrela. Pacote com ' || v_n || ' unidades.',
              case when v_n = 10 then 20 else 35 end, null, v_foto, v_cat, true, case when v_n = 10 then 0 else 1 end)
      returning id into v_prod;
      insert into yasfood.product_media (product_id, kind, url, sort_order)
      values (v_prod, 'image', v_foto, 0), (v_prod, 'image', v_real, 1);
    end if;
    if not exists (select 1 from yasfood.product_ingredients where product_id = v_prod) then
      perform pg_temp.receita(v_prod, v_marg, 200 * v_f);
      perform pg_temp.receita(v_prod, v_acucar, 150 * v_f);
      perform pg_temp.receita(v_prod, v_ovo, 1 * v_f);
      perform pg_temp.receita(v_prod, v_baun, 5 * v_f);      -- 1 colher de chá
      perform pg_temp.receita(v_prod, v_farinha, 350 * v_f);
      perform pg_temp.receita(v_prod, v_cacau, 40 * v_f);
      perform pg_temp.receita(v_prod, v_amido, 50 * v_f);
    end if;
  end loop;

  insert into yasfood.seeds_aplicadas (key) values ('biscoitos_natal_v1');
end $$;
