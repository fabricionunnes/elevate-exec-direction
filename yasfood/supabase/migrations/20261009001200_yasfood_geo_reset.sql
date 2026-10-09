-- A primeira versão do localizador aceitava resultado de qualquer cidade.
-- Zera as localizações feitas antes da validação pra serem refeitas pelo painel.
update yasfood.orders
set lat = null, lng = null, geocoded_at = null
where geocoded_at is not null and geocoded_at < '2026-10-09 12:00:00+00';
