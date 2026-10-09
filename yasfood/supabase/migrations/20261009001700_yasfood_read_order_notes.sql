-- O que a IA precisa saber ao ler prints (a Yasmim edita em Configurações).
alter table yasfood.settings add column if not exists read_order_notes text not null default '';

update yasfood.settings
set read_order_notes = 'Costa Laguna é o condomínio da Yasmim: pedido do Costa Laguna é da região "Meu condomínio (Alphaville)".'
where id = 1 and read_order_notes = '';

-- A região da casa dela passa a dizer o nome do condomínio.
update yasfood.delivery_zones
set notes = 'Condomínio da Yasmim (Costa Laguna). Entrega sem custo.'
where name = 'Meu condomínio (Alphaville)' and (notes is null or notes = '' or notes = 'Entrega sem custo dentro do condomínio');
