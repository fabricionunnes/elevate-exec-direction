-- Follow-up personalizado do lead (aba "Follow up personalizado" do CRM Comercial).
-- Guarda os follow-ups ENVIADOS por lead — memória da régua: a edge function
-- lead-followup lê esse histórico pra dar continuidade (novidade de mercado
-- sem repetir a anterior, amarrando com o que a UNV faz).
-- Opções geradas mas não enviadas não são persistidas.

create table if not exists public.crm_lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  message text not null,
  angle text,                 -- ângulo/tema da mensagem
  news_headline text,         -- manchete da notícia real citada
  news_url text,
  news_source text,
  instance_id uuid references public.whatsapp_instances(id) on delete set null,
  sent_by uuid references public.onboarding_staff(id) on delete set null,
  status text not null default 'sent',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists crm_lead_followups_lead_idx on public.crm_lead_followups(lead_id);

alter table public.crm_lead_followups enable row level security;

-- mesmo padrão das demais tabelas crm_* (staff autenticado + bloqueio de tenant whitelabel)
drop policy if exists "Authenticated users can read lead followups" on public.crm_lead_followups;
create policy "Authenticated users can read lead followups" on public.crm_lead_followups
  for select to authenticated using (true);

drop policy if exists "Authenticated users can insert lead followups" on public.crm_lead_followups;
create policy "Authenticated users can insert lead followups" on public.crm_lead_followups
  for insert to authenticated with check (true);

drop policy if exists "Tenant isolation block" on public.crm_lead_followups;
create policy "Tenant isolation block" on public.crm_lead_followups
  as restrictive for all to authenticated
  using (not current_user_is_tenant()) with check (not current_user_is_tenant());
