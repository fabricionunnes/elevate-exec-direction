-- Rota errada: a origem (casa) e alguns endereços caíram no centro de Nova Lima,
-- que é pra onde o mapa manda quando não acha a rua. Limpa pra refazer com a regra nova
-- (tudo amarrado no Alphaville Lagoa dos Ingleses).

-- casa marcada no centro da cidade: volta a pedir o GPS nas configurações
update yasfood.settings
set origin_lat = null, origin_lng = null
where origin_lat is not null and origin_lng is not null
  and abs(origin_lat - (-19.98556)) < 0.015 and abs(origin_lng - (-43.84667)) < 0.015;

-- pedidos ativos localizados na cidade de Nova Lima (bairros Centro, Vila Operária, Vale da Esperança…): refazer
update yasfood.orders
set lat = null, lng = null, geocoded_at = null
where lat is not null and lng is not null
  and status not in ('entregue', 'cancelado')
  and abs(lat - (-19.9856)) < 0.04 and abs(lng - (-43.8467)) < 0.05;

-- localização aprendida do cliente que caiu lá também não vale
update yasfood.customers
set lat = null, lng = null, geo_address = null
where lat is not null and lng is not null
  and abs(lat - (-19.9856)) < 0.04 and abs(lng - (-43.8467)) < 0.05;
