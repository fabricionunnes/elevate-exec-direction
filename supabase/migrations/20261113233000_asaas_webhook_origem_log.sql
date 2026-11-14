-- Recebedor do Asaas: eventos que chegaram sem a origem conferida (13/11/2026).
-- O asaas-webhook grava aqui toda chamada que não veio com o token do Asaas (asaas-access-token)
-- nem com a chave de serviço (chamada interna). Serve pra decidir quando ligar o bloqueio
-- (ASAAS_WEBHOOK_AUTH_MODE=exigir) e pra auditar tentativa de evento forjado.
create table if not exists public.asaas_webhook_origem_log (
  id bigint generated always as identity primary key,
  recebido_em timestamptz not null default now(),
  evento text,
  payment_id text,
  motivo text,
  modo text,               -- observar | exigir
  bloqueado boolean not null default false,
  tem_cabecalho boolean not null default false,
  impressao text,          -- 8 hex do SHA-256 do token recebido (nunca o token)
  ip text,
  user_agent text
);
create index if not exists asaas_webhook_origem_log_recebido on public.asaas_webhook_origem_log (recebido_em desc);
alter table public.asaas_webhook_origem_log enable row level security;
grant all on public.asaas_webhook_origem_log to service_role;
grant select on public.asaas_webhook_origem_log to authenticated;
drop policy if exists "staff vê origem dos eventos do asaas" on public.asaas_webhook_origem_log;
create policy "staff vê origem dos eventos do asaas" on public.asaas_webhook_origem_log for select to authenticated
  using (exists (select 1 from public.onboarding_staff s where s.user_id = auth.uid() and s.is_active));
select count(*) linhas from public.asaas_webhook_origem_log;
