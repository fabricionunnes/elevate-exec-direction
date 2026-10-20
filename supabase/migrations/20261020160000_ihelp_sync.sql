-- Integração iHelpChat (app.ihelpchat.com, CRM próprio) → KPIs do Nexus. Primeira empresa: Instituto Educação Sant'Ana (20/10/2026).
create table if not exists public.ihelp_sync_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  project_id uuid references public.onboarding_projects(id) on delete set null,
  base_url text not null default 'https://apiv3.ihelpchat.com/api/v2/',
  enabled boolean not null default true,
  kpi_map jsonb not null default '{}'::jsonb,
  regras jsonb not null default '{}'::jsonb,
  api_token text,
  last_run_at timestamptz,
  last_result jsonb,
  created_at timestamptz not null default now()
);
alter table public.ihelp_sync_configs enable row level security;
grant select, insert, update, delete on public.ihelp_sync_configs to service_role;
create table if not exists public.ihelp_kpi_events (
  config_id uuid not null references public.ihelp_sync_configs(id) on delete cascade,
  ref_id text not null,
  kpi text not null,
  salesperson_id uuid,
  entry_date date not null,
  value numeric not null default 1,
  created_at timestamptz not null default now(),
  primary key (config_id, ref_id, kpi)
);
alter table public.ihelp_kpi_events enable row level security;
grant select, insert, update, delete on public.ihelp_kpi_events to service_role;
