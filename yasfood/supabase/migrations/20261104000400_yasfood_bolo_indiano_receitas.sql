-- Bolo Indiano (R$ 50) com receita de 1 bolo (a receita base rende 2: aqui vai a metade)
-- e receita do Pão de Batata Recheado por kit de 4 (a base rende 15 pães: aqui vai 4/15).
-- Insumo que não existe é criado com custo estimado de mercado; a Yasmim corrige ao lançar a nota.
-- Roda uma vez só (seeds_aplicadas); não mexe em receita que ela já tiver montado no painel.
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
  v_bolo uuid; v_pao uuid; v_cat text; v_leite uuid;
begin
  if exists (select 1 from yasfood.seeds_aplicadas where key = 'receitas_indiano_pao_v1') then return; end if;

  select coalesce((select name from yasfood.categories where name = 'Bolos'),
                  (select name from yasfood.categories order by sort_order, name limit 1)) into v_cat;

  -- leite: o insumo atual se chama pela nota (LTE L V ...); senão cria "Leite"
  select id into v_leite from yasfood.ingredients
  where unit = 'ml' and (name ilike 'LTE L V%' or name ilike 'leite' or name ilike 'leite integral%')
  order by active desc, created_at limit 1;
  if v_leite is null then v_leite := pg_temp.insumo('leite', 'Leite', 'ml', 0.005); end if;

  -- Bolo Indiano
  select id into v_bolo from yasfood.products where name ilike 'bolo indiano%' order by created_at limit 1;
  if v_bolo is null then
    insert into yasfood.products (name, description, price, weight_g, image_url, category, active, sort_order)
    values ('Bolo Indiano',
            'Bolo fofinho de canela, com cobertura cremosa e canela polvilhada por cima.',
            50, null, 'https://yasfood.unvholdings.workers.dev/produtos/bolo-indiano.jpg', v_cat, true, 0)
    returning id into v_bolo;
    insert into yasfood.product_media (product_id, kind, url, sort_order)
    values (v_bolo, 'image', 'https://yasfood.unvholdings.workers.dev/produtos/bolo-indiano.jpg', 0);
  end if;
  if not exists (select 1 from yasfood.product_ingredients where product_id = v_bolo) then
    perform pg_temp.receita(v_bolo, pg_temp.insumo('ovos', 'Ovos', 'un', 0.65), 2);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('açúcar', 'Açúcar', 'g', 0.0035), 100);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('manteiga', 'Manteiga', 'g', 0.014), 22.5);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('farinha de trigo', 'Farinha de trigo', 'g', 0.0044), 120);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('farinha de rosca%', 'Farinha de rosca', 'g', 0.012), 25);
    perform pg_temp.receita(v_bolo, v_leite, 60);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('canela%', 'Canela em pó', 'g', 0.12), 4);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('fermento em pó', 'Fermento em pó', 'g', 0.045), 6);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('embalagem com tampa', 'Embalagem com tampa', 'un', 1.0), 1);
  end if;

  -- Pão de Batata Recheado: kit de 4 pães = 4/15 da receita
  select id into v_pao from yasfood.products where name ilike 'pão de batata%' order by active desc, created_at limit 1;
  if v_pao is not null and not exists (select 1 from yasfood.product_ingredients where product_id = v_pao) then
    perform pg_temp.receita(v_pao, pg_temp.insumo('farinha de trigo', 'Farinha de trigo', 'g', 0.0044), round(500 * 4 / 15.0, 3));
    perform pg_temp.receita(v_pao, pg_temp.insumo('batata%', 'Batata', 'g', 0.006), round(250 * 4 / 15.0, 3));
    perform pg_temp.receita(v_pao, v_leite, round(100 * 4 / 15.0, 3));
    perform pg_temp.receita(v_pao, pg_temp.insumo('ovos', 'Ovos', 'un', 0.65), round(1 * 4 / 15.0, 3));
    perform pg_temp.receita(v_pao, pg_temp.insumo('açúcar', 'Açúcar', 'g', 0.0035), round(50 * 4 / 15.0, 3));
    perform pg_temp.receita(v_pao, pg_temp.insumo('manteiga', 'Manteiga', 'g', 0.014), round(50 * 4 / 15.0, 3));
    perform pg_temp.receita(v_pao, pg_temp.insumo('sal', 'Sal', 'g', 0.002), round(8 * 4 / 15.0, 3));
    perform pg_temp.receita(v_pao, pg_temp.insumo('fermento biol%', 'Fermento biológico seco', 'g', 0.10), round(10 * 4 / 15.0, 3));
    perform pg_temp.receita(v_pao, pg_temp.insumo('mu_arela%', 'Mussarela', 'g', 0.045), 60);
  end if;

  insert into yasfood.seeds_aplicadas (key) values ('receitas_indiano_pao_v1');
end $$;
