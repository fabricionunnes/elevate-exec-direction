-- Kommo → Nexus: sincronização de KPIs a partir do CRM Kommo (ex-amoCRM).
-- Config por empresa; a edge `kommo-sync` lê o histórico de mudança de etapa
-- (/api/v4/events) e os leads ganhos, e grava o consolidado por (vendedor, dia)
-- em kpi_entries com a tag [KOMMO] — Kommo é a fonte da verdade desses KPIs.

create table if not exists public.kommo_sync_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  label text,
  subdomain text not null,                   -- <subdomain>.kommo.com
  secret_name text not null,                 -- secret com o token de longa duração
  enabled boolean not null default true,
  -- [{ "kpi_id", "kpi_name", "kind": "created"|"stage"|"won"|"lost",
  --    "value": null|"price", "stages": [{"pipeline_id","status_id","name"}],
  --    "pipelines": [ids] (kind created/won/lost: restringe aos funis) }]
  kpi_map jsonb not null default '[]'::jsonb,
  -- kommo user id -> salesperson_id (Nexus)
  user_overrides jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  last_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

alter table public.kommo_sync_configs enable row level security;
drop policy if exists kommo_sync_configs_staff on public.kommo_sync_configs;
create policy kommo_sync_configs_staff on public.kommo_sync_configs
  for all to authenticated
  using (public.is_staff_admin_or_master())
  with check (public.is_staff_admin_or_master());
grant select, insert, update, delete on public.kommo_sync_configs to authenticated;
grant all on public.kommo_sync_configs to service_role;
