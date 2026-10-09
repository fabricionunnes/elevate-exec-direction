-- Localização aprendida do cliente: marcada pela Yasmim na porta (GPS) ou pelo localizador.
-- Nos próximos pedidos com o mesmo endereço, a coordenada é reaproveitada.
alter table yasfood.customers add column if not exists lat double precision;
alter table yasfood.customers add column if not exists lng double precision;
alter table yasfood.customers add column if not exists geo_address text;
