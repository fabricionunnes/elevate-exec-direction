-- Pix Automático (Asaas) nas recorrências do Nexus (Fabrício, 09/11/2026: "quero poder escolher se quero
-- que seja pix recorrência, que é aquele que o cliente autoriza a recorrência via pix ser descontada
-- automaticamente"). Uma linha por autorização criada no Asaas (POST /v3/pix/automatic/authorizations),
-- venha da recorrência da empresa (asaas-subscription) ou do pagamento do lead no CRM (asaas-lead-subscription).
-- O QR Code do primeiro pagamento fica aqui pra página pública /#/pix-automatico/<id> (função pix-automatico),
-- e o asaas-webhook atualiza o status (CREATED → ACTIVE / REFUSED / CANCELLED / EXPIRED).
create table if not exists public.asaas_pix_automatico (
  id text primary key,                       -- id da autorização no Asaas
  origem text not null check (origem in ('empresa', 'lead')),
  recurring_charge_id uuid references public.company_recurring_charges(id) on delete set null,
  company_id uuid,
  lead_id uuid,
  lead_payment_id uuid,
  asaas_account_id uuid,                     -- conta da recorrência da empresa (null = chave padrão)
  conta_crm text,                            -- 'principal' | 'social' (pagamento do lead)
  customer_id text,
  subscription_id text,                      -- assinatura que o Asaas cria no modo SUBSCRIPTION
  contract_id text,
  valor_cents integer not null,
  frequencia text not null,                  -- MONTHLY | QUARTERLY | ANNUALLY
  primeira_cobranca date,                    -- vencimento coberto pelo QR (1ª parcela)
  start_date date,                           -- 1º débito automático
  descricao text,
  cliente_nome text,
  status text not null default 'CREATED',
  qr_payload text,
  qr_image text,                             -- base64 (png) do QR Code
  qr_expira_em timestamptz,
  ultimo_evento text,
  primeiro_pagamento_id text,
  pago_em timestamptz,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists asaas_pix_automatico_charge_idx on public.asaas_pix_automatico (recurring_charge_id);
create index if not exists asaas_pix_automatico_lead_payment_idx on public.asaas_pix_automatico (lead_payment_id);
create index if not exists asaas_pix_automatico_subscription_idx on public.asaas_pix_automatico (subscription_id);

alter table public.asaas_pix_automatico enable row level security;
drop policy if exists "staff le pix automatico" on public.asaas_pix_automatico;
create policy "staff le pix automatico" on public.asaas_pix_automatico
  for select to authenticated
  using (exists (select 1 from public.onboarding_staff s where s.user_id = auth.uid() and s.is_active));

grant select on public.asaas_pix_automatico to authenticated;
grant all on public.asaas_pix_automatico to service_role;
notify pgrst, 'reload schema';
