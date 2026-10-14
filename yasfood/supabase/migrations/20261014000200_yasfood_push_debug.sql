-- Registro das tentativas de ligar a notificação no celular (pra achar onde trava sem precisar de print).
create table if not exists yasfood.push_debug (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  step text not null,
  ok boolean not null default true,
  info jsonb not null default '{}'::jsonb
);
alter table yasfood.push_debug enable row level security;
drop policy if exists push_debug_admin on yasfood.push_debug;
create policy push_debug_admin on yasfood.push_debug for all using (yasfood.is_admin()) with check (yasfood.is_admin());
grant select, insert on yasfood.push_debug to authenticated;
grant usage on sequence yasfood.push_debug_id_seq to authenticated;
-- guarda só os últimos 30 dias
delete from yasfood.push_debug where created_at < now() - interval '30 days';
