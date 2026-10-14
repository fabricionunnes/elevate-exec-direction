-- Notificação no celular da Yasmim com o app fechado (Web Push).
-- push_subscriptions: um registro por aparelho que ativou. push_keys: par VAPID (privado, só o servidor lê).

create table if not exists yasfood.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text not null default '',
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fail_count int not null default 0
);
alter table yasfood.push_subscriptions enable row level security;
drop policy if exists push_subs_admin_all on yasfood.push_subscriptions;
create policy push_subs_admin_all on yasfood.push_subscriptions for all using (yasfood.is_admin()) with check (yasfood.is_admin());
grant select, insert, update, delete on yasfood.push_subscriptions to authenticated;
grant select, insert, update, delete on yasfood.push_subscriptions to service_role;

-- Chave privada VAPID: RLS ligada e nenhuma policy, sem grant pra anon/authenticated. Só a função (service_role) lê.
create table if not exists yasfood.push_keys (
  id int primary key default 1 check (id = 1),
  public_key text not null,
  private_jwk jsonb not null,
  created_at timestamptz not null default now()
);
alter table yasfood.push_keys enable row level security;
revoke all on yasfood.push_keys from anon, authenticated;
grant select, insert, update on yasfood.push_keys to service_role;

-- Cada pedido novo gera uma notificação só (a função marca aqui antes de enviar)
alter table yasfood.orders add column if not exists push_notified_at timestamptz;
update yasfood.orders set push_notified_at = coalesce(push_notified_at, now())
where push_notified_at is null and created_at < now() - interval '10 minutes';
