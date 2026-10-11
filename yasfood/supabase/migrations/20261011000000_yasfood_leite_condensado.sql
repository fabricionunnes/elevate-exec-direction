-- Leite condensado foi trocado no Estoque pra "un" a R$ 7,00 (a lata), mas a receita usa 200 (g).
-- 200 × 7 = R$ 1.400 por bolo. Volta pra como estava em 10/10 às 13h: grama, lata de 395 g,
-- R$ 0,0139/g (R$ 5,48 a lata). O saldo não muda (já está em gramas).
update yasfood.ingredients
set unit = 'g', pack_size = 395, pack_label = 'lata', cost_per_unit = 0.0139
where name = 'Leite condensado' and unit = 'un';
