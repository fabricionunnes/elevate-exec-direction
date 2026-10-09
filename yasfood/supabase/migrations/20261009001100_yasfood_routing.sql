-- Prioridade automática dos pedidos e rota de entrega (mais perto primeiro).
-- Coordenadas ficam no pedido (geocodificadas pelo painel), na zona (fallback)
-- e na origem (casa da Yasmim, nas configurações).

alter table yasfood.orders add column if not exists lat double precision;
alter table yasfood.orders add column if not exists lng double precision;
alter table yasfood.orders add column if not exists geocoded_at timestamptz;

alter table yasfood.delivery_zones add column if not exists lat double precision;
alter table yasfood.delivery_zones add column if not exists lng double precision;

alter table yasfood.settings add column if not exists origin_lat double precision;
alter table yasfood.settings add column if not exists origin_lng double precision;

-- Se o endereço do pedido mudar (edição pela Yasmim), a localização antiga perde a validade.
create or replace function yasfood.orders_reset_geo()
returns trigger
language plpgsql
as $$
begin
  if (new.address is distinct from old.address or new.zone_id is distinct from old.zone_id)
     and new.lat is not distinct from old.lat and new.lng is not distinct from old.lng then
    new.lat := null;
    new.lng := null;
    new.geocoded_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_reset_geo on yasfood.orders;
create trigger orders_reset_geo before update on yasfood.orders
  for each row execute function yasfood.orders_reset_geo();
