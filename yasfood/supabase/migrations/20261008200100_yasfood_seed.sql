-- Dados iniciais pra Yasmim começar a vender no mesmo dia.
-- Tudo pode ser editado no painel.

update public.settings set
  business_name = 'Yas Delícias',
  whatsapp = '5531992372507',
  pix_name = 'Yasmim',
  min_lead_days = 1,
  pickup_enabled = true,
  pickup_address = 'Retirada combinada pelo WhatsApp',
  default_daily_capacity = 10
where id = 1;

insert into public.products (name, description, price, weight_g, category, sort_order) values
  ('Bolo de Cenoura com Cobertura de Chocolate', 'Massa fofinha de cenoura de verdade, assada no dia, com cobertura cremosa de chocolate que escorre pelas laterais. 570g.', 35.00, 570, 'Bolos', 1),
  ('Bolo de Cenoura sem Cobertura', 'O mesmo bolo caseiro, dourado por fora e macio por dentro, pra quem prefere puro. 570g.', 35.00, 570, 'Bolos', 2)
on conflict do nothing;

insert into public.delivery_zones (name, fee, sort_order, notes) values
  ('Meu condomínio (entrega no apê)', 0, 1, 'Entrega sem custo dentro do condomínio'),
  ('Condomínios vizinhos', 5, 2, ''),
  ('Bairro (até 3 km)', 10, 3, '')
on conflict do nothing;

-- Insumos com custo aproximado (ajuste no painel de estoque)
insert into public.ingredients (name, unit, qty_on_hand, min_qty, cost_per_unit, supplier) values
  ('Cenoura', 'g', 3000, 1000, 0.006, 'Hortifruti'),
  ('Farinha de trigo', 'g', 5000, 1000, 0.005, 'Supermercado'),
  ('Açúcar', 'g', 5000, 1000, 0.004, 'Supermercado'),
  ('Ovos', 'un', 30, 12, 0.80, 'Supermercado'),
  ('Óleo', 'ml', 2000, 500, 0.008, 'Supermercado'),
  ('Fermento em pó', 'g', 300, 100, 0.04, 'Supermercado'),
  ('Chocolate em pó', 'g', 1000, 300, 0.03, 'Supermercado'),
  ('Leite condensado', 'g', 2000, 400, 0.012, 'Supermercado'),
  ('Manteiga', 'g', 1000, 200, 0.03, 'Supermercado'),
  ('Embalagem com tampa', 'un', 20, 5, 2.50, 'Loja de embalagens')
on conflict do nothing;

-- Receita aproximada por bolo (ajuste conforme a receita real da Yasmim)
insert into public.product_ingredients (product_id, ingredient_id, qty)
select p.id, i.id, r.qty
from (values
  ('Bolo de Cenoura com Cobertura de Chocolate', 'Cenoura', 250),
  ('Bolo de Cenoura com Cobertura de Chocolate', 'Farinha de trigo', 250),
  ('Bolo de Cenoura com Cobertura de Chocolate', 'Açúcar', 220),
  ('Bolo de Cenoura com Cobertura de Chocolate', 'Ovos', 3),
  ('Bolo de Cenoura com Cobertura de Chocolate', 'Óleo', 120),
  ('Bolo de Cenoura com Cobertura de Chocolate', 'Fermento em pó', 12),
  ('Bolo de Cenoura com Cobertura de Chocolate', 'Chocolate em pó', 40),
  ('Bolo de Cenoura com Cobertura de Chocolate', 'Leite condensado', 200),
  ('Bolo de Cenoura com Cobertura de Chocolate', 'Manteiga', 20),
  ('Bolo de Cenoura com Cobertura de Chocolate', 'Embalagem com tampa', 1),
  ('Bolo de Cenoura sem Cobertura', 'Cenoura', 250),
  ('Bolo de Cenoura sem Cobertura', 'Farinha de trigo', 250),
  ('Bolo de Cenoura sem Cobertura', 'Açúcar', 220),
  ('Bolo de Cenoura sem Cobertura', 'Ovos', 3),
  ('Bolo de Cenoura sem Cobertura', 'Óleo', 120),
  ('Bolo de Cenoura sem Cobertura', 'Fermento em pó', 12),
  ('Bolo de Cenoura sem Cobertura', 'Embalagem com tampa', 1)
) as r(product_name, ingredient_name, qty)
join public.products p on p.name = r.product_name
join public.ingredients i on i.name = r.ingredient_name
on conflict do nothing;

-- Abre a agenda dos próximos 30 dias, segunda a sábado, 10 bolos/dia
insert into public.capacity_days (day, max_units, is_open)
select d::date, 10, true
from generate_series(current_date + 1, current_date + 30, interval '1 day') as d
where extract(dow from d) between 1 and 6
on conflict (day) do nothing;
