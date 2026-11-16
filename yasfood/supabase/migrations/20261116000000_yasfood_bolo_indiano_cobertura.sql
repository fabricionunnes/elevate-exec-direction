-- Bolo Indiano: receita de 1 bolo (~590 g) com cobertura branca de leite em pó e canela.
-- Massa: 2 ovos, 100 g açúcar, 22 g manteiga, 120 g farinha, 25 g farinha de rosca, 60 ml leite, 4 g canela, 6 g fermento.
-- Cobertura: 120 g leite condensado, 60 g creme de leite (0,3 caixa de 200 g), 8 g leite em pó, 5 g manteiga, canela a gosto (~1 g).
-- Embalagem com tampa continua (1 por bolo). Troca a receita inteira, uma vez só (seeds_aplicadas).
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
declare v_bolo uuid; v_leite uuid;
begin
  if exists (select 1 from yasfood.seeds_aplicadas where key = 'receita_indiano_cobertura_v1') then return; end if;

  select id into v_bolo from yasfood.products where name ilike 'bolo indiano%' order by created_at limit 1;
  if v_bolo is not null then
    select id into v_leite from yasfood.ingredients
    where unit = 'ml' and (name ilike 'LTE L V%' or name ilike 'leite' or name ilike 'leite integral%')
    order by active desc, created_at limit 1;
    if v_leite is null then v_leite := pg_temp.insumo('leite', 'Leite', 'ml', 0.005); end if;

    delete from yasfood.product_ingredients where product_id = v_bolo;
    -- massa
    perform pg_temp.receita(v_bolo, pg_temp.insumo('ovos', 'Ovos', 'un', 0.65), 2);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('açúcar', 'Açúcar', 'g', 0.0035), 100);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('manteiga', 'Manteiga', 'g', 0.014), 22 + 5);   -- massa + cobertura
    perform pg_temp.receita(v_bolo, pg_temp.insumo('farinha de trigo', 'Farinha de trigo', 'g', 0.0044), 120);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('farinha de rosca%', 'Farinha de rosca', 'g', 0.012), 25);
    perform pg_temp.receita(v_bolo, v_leite, 60);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('canela%', 'Canela em pó', 'g', 0.12), 4 + 1); -- massa + polvilhar
    perform pg_temp.receita(v_bolo, pg_temp.insumo('fermento em pó', 'Fermento em pó', 'g', 0.045), 6);
    -- cobertura branca
    perform pg_temp.receita(v_bolo, pg_temp.insumo('leite condensado%', 'Leite condensado', 'g', 0.014), 120);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('creme de leite%', 'Creme de leite', 'un', 2.78), 0.3);
    perform pg_temp.receita(v_bolo, pg_temp.insumo('leite em p%', 'Leite em pó integral', 'g', 0.045), 8);
    -- embalagem
    perform pg_temp.receita(v_bolo, pg_temp.insumo('embalagem com tampa', 'Embalagem com tampa', 'un', 1.0), 1);
  end if;

  insert into yasfood.seeds_aplicadas (key) values ('receita_indiano_cobertura_v1');
end $$;
