-- Chocotone: receita da Yasmim rende 2; aqui vai a metade (1 chocotone).
-- Esponja: 100 g farinha forte, 100 ml água, 5 g fermento biológico.
-- Massa: 400 g farinha forte, 100 g açúcar, 3 gemas + 1 ovo, 100 g manteiga sem sal, 80 ml leite,
-- 20 g mel, 15 g leite em pó, 8 g sal, 5 ml essência de panetone, 2 ml essência de baunilha, 200 g gotas de chocolate.
-- Água não entra (sem custo). Gemas contam como ovos inteiros. Insumo que não existe entra com custo estimado.
-- Só monta se o produto ainda não tiver receita; uma vez só (seeds_aplicadas).
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
declare v_prod uuid; v_leite uuid;
begin
  if exists (select 1 from yasfood.seeds_aplicadas where key = 'receita_chocotone_v1') then return; end if;

  select id into v_prod from yasfood.products where name ilike 'chocotone%' order by active desc, created_at limit 1;
  if v_prod is not null and not exists (select 1 from yasfood.product_ingredients where product_id = v_prod) then
    select id into v_leite from yasfood.ingredients
    where unit = 'ml' and (name ilike 'LTE L V%' or name ilike 'leite' or name ilike 'leite integral%')
    order by active desc, created_at limit 1;
    if v_leite is null then v_leite := pg_temp.insumo('leite', 'Leite', 'ml', 0.005); end if;

    perform pg_temp.receita(v_prod, pg_temp.insumo('farinha de trigo', 'Farinha de trigo', 'g', 0.0044), (100 + 400) / 2.0);
    perform pg_temp.receita(v_prod, pg_temp.insumo('fermento biol%', 'Fermento biológico seco', 'g', 0.2), 5 / 2.0);
    perform pg_temp.receita(v_prod, pg_temp.insumo('açúcar', 'Açúcar', 'g', 0.0035), 100 / 2.0);
    perform pg_temp.receita(v_prod, pg_temp.insumo('ovos', 'Ovos', 'un', 0.65), (3 + 1) / 2.0);  -- 3 gemas + 1 ovo
    perform pg_temp.receita(v_prod, pg_temp.insumo('manteiga', 'Manteiga', 'g', 0.014), 100 / 2.0);
    perform pg_temp.receita(v_prod, v_leite, 80 / 2.0);
    perform pg_temp.receita(v_prod, pg_temp.insumo('mel%', 'Mel', 'g', 0.045), 20 / 2.0);
    perform pg_temp.receita(v_prod, pg_temp.insumo('leite em p%', 'Leite em pó integral', 'g', 0.045), 15 / 2.0);
    perform pg_temp.receita(v_prod, pg_temp.insumo('sal', 'Sal', 'g', 0.0025), 8 / 2.0);
    perform pg_temp.receita(v_prod, pg_temp.insumo('ess%panetone%', 'Essência de panetone', 'ml', 0.5), 5 / 2.0);
    perform pg_temp.receita(v_prod, pg_temp.insumo('ESS%BAUN%', 'Essência de baunilha', 'ml', 0.38), 2 / 2.0);
    perform pg_temp.receita(v_prod, pg_temp.insumo('gotas de chocolate%', 'Gotas de chocolate forneáveis', 'g', 0.045), 200 / 2.0);
  end if;

  insert into yasfood.seeds_aplicadas (key) values ('receita_chocotone_v1');
end $$;
