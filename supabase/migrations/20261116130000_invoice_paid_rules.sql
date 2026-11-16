-- Regras "pagou esta parcela, exclui aquela" (16/11/2026).
-- Fabrício, sobre a Duarte: "gerei um link de 3 mil no cartão, no link do banco da Yasmim, se ele pagar,
-- quero que exclua a parcela deste mês dele". Quem executa é o mercadopago-webhook, na baixa da parcela
-- paga pelo link do Mercado Pago: apaga a cobrança no Asaas (asaas-delete-payment) e a parcela no Nexus,
-- só se ela ainda estiver em aberto. Cada regra roda uma vez e guarda o resultado.
create table if not exists public.invoice_paid_rules (
  id uuid primary key default gen_random_uuid(),
  paid_invoice_id uuid not null,      -- quando esta parcela for paga...
  delete_invoice_id uuid not null,    -- ...exclui esta, se ainda estiver em aberto
  note text,
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  result jsonb
);
create index if not exists invoice_paid_rules_pendentes on public.invoice_paid_rules (paid_invoice_id) where executed_at is null;
alter table public.invoice_paid_rules enable row level security;
grant all on public.invoice_paid_rules to service_role;
grant select on public.invoice_paid_rules to authenticated;
drop policy if exists "staff vê regras ao pagar" on public.invoice_paid_rules;
create policy "staff vê regras ao pagar" on public.invoice_paid_rules for select to authenticated
  using (exists (select 1 from public.onboarding_staff s where s.user_id = auth.uid() and s.is_active));
select count(*) linhas from public.invoice_paid_rules;
