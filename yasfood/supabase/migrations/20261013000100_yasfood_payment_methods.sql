-- Formas de pagamento aceitas no site, escolhidas em Configurações. Começa só com Pix
-- (cartão e dinheiro desligados, pedido do Fabrício em 13/10). Pedido manual da Yasmim pode usar qualquer uma.
alter table yasfood.settings add column if not exists payment_methods text[] not null default '{pix}';
update yasfood.settings set payment_methods = '{pix}' where id = 1;

drop view if exists yasfood.public_settings;
create view yasfood.public_settings as
select id, business_name, whatsapp, pix_key, pix_name, min_lead_days, pickup_enabled, pickup_address,
       is_open, closed_message, logo_url, instagram, site_url, hero_title, hero_subtitle, payment_methods
from yasfood.settings;
grant select on yasfood.public_settings to anon, authenticated;

-- Cliente só fecha pedido com forma ligada; a Yasmim (admin) pode lançar com qualquer uma.
create or replace function yasfood.orders_check_payment()
returns trigger
language plpgsql
as $$
declare
  v_allowed text[];
begin
  if yasfood.is_admin() then return new; end if;
  select payment_methods into v_allowed from yasfood.settings where id = 1;
  if v_allowed is not null and array_length(v_allowed, 1) > 0 and not (new.payment_method = any(v_allowed)) then
    raise exception 'DADOS: essa forma de pagamento não está disponível no momento';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_check_payment on yasfood.orders;
create trigger orders_check_payment before insert on yasfood.orders
  for each row execute function yasfood.orders_check_payment();
