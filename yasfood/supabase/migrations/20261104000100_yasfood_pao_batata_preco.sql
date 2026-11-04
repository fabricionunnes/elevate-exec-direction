-- Pão de Batata: kit com 4 a R$ 20, no ar. Só mexe se ainda estiver com o preço zerado do cadastro inicial.
update yasfood.products
set name = 'Pão de Batata recheado (4 unidades)',
    description = 'Kit com 4 pães de batata fofinhos, recheados com presunto e muita mussarela derretendo.',
    price = 20,
    active = true
where name ilike 'pão de batata%' and price = 0;
