-- Pedidos de transferência de lead feitos pela tela "sem acesso" (edge crm-lead-request).
create table if not exists public.crm_lead_access_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  requester_staff_id uuid not null references public.onboarding_staff(id) on delete cascade,
  notified text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists crm_lead_access_requests_lead_idx on public.crm_lead_access_requests (lead_id, requester_staff_id, created_at desc);
alter table public.crm_lead_access_requests enable row level security;
revoke all on public.crm_lead_access_requests from anon, authenticated;
grant select, insert, update, delete on public.crm_lead_access_requests to service_role;
