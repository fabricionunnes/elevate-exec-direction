-- Localizações feitas antes da regra do raio por região: refazer (só pedidos de hoje em diante).
update yasfood.orders
set lat = null, lng = null, geocoded_at = null
where geocoded_at is not null and geocoded_at < '2026-10-10 13:00:00+00' and scheduled_date >= (now() at time zone 'America/Sao_Paulo')::date;
