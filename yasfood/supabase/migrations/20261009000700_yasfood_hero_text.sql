-- Título e subtítulo do topo do cardápio, editáveis no painel
alter table yasfood.settings
  add column if not exists hero_title text not null default 'Feito em casa, com carinho de verdade.',
  add column if not exists hero_subtitle text not null default 'Bolos, biscoitos e outras delícias preparadas no dia. Entregamos nos condomínios do Alphaville. Escolha, marque a data e pronto.';

create or replace view yasfood.public_settings as
select id, business_name, whatsapp, pix_key, pix_name, min_lead_days, pickup_enabled, pickup_address,
       is_open, closed_message, logo_url, instagram, site_url, hero_title, hero_subtitle
from yasfood.settings;
grant select on yasfood.public_settings to anon, authenticated;
