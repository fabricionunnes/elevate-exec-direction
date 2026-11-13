-- Pix Automático: tentativas de débito recusadas (13/11/2026).
-- O asaas-webhook grava; a régua (billing-notifications) avisa o cliente no mesmo dia.
create table if not exists public.pix_automatico_recusas (
  id text primary key,                 -- id da instrução de pagamento no Asaas
  authorization_id text,
  payment_id text,
  due_date date,
  recurring_charge_id uuid,
  company_id uuid,
  invoice_id uuid,
  evento text not null,
  payload jsonb,
  recebido_em timestamptz not null default now(),
  aviso_status text not null default 'pendente',  -- pendente | enviado | falhou | dispensado
  aviso_motivo text,
  avisado_em timestamptz,
  tentativas integer not null default 0
);
create index if not exists pix_automatico_recusas_pendentes on public.pix_automatico_recusas (recebido_em) where aviso_status = 'pendente';
create index if not exists pix_automatico_recusas_invoice on public.pix_automatico_recusas (invoice_id);
alter table public.pix_automatico_recusas enable row level security;
grant all on public.pix_automatico_recusas to service_role;
grant select on public.pix_automatico_recusas to authenticated;
drop policy if exists "staff vê recusas do pix automático" on public.pix_automatico_recusas;
create policy "staff vê recusas do pix automático" on public.pix_automatico_recusas for select to authenticated
  using (exists (select 1 from public.onboarding_staff s where s.user_id = auth.uid() and s.is_active));
select count(*) linhas from public.pix_automatico_recusas;
