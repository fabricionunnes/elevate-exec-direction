-- Origem do pedido: 'site' (cliente pediu pelo cardápio) ou 'painel' (Yasmim lançou por dentro,
-- digitado ou lido de print). Pedido do painel não notifica o celular nem pisca no alerta.

alter table yasfood.orders add column if not exists origin text not null default 'site';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_origin_check' and conrelid = 'yasfood.orders'::regclass) then
    alter table yasfood.orders add constraint orders_origin_check check (origin in ('site', 'painel'));
  end if;
end $$;

-- Quem cria o pedido logada como admin é o painel. Já nasce marcado como avisado, então o push nunca pega.
create or replace function yasfood.orders_set_origin()
returns trigger
language plpgsql
as $$
begin
  if yasfood.is_admin() then
    new.origin := 'painel';
    new.push_notified_at := coalesce(new.push_notified_at, now());
  else
    new.origin := 'site';
  end if;
  return new;
end $$;
drop trigger if exists orders_set_origin on yasfood.orders;
create trigger orders_set_origin before insert on yasfood.orders
  for each row execute function yasfood.orders_set_origin();
