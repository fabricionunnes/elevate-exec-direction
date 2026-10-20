-- Integração OniChat (Chatwoot de marca própria) → KPIs do Nexus. Primeira empresa: MARTINS DE ANDRADE ADVOGADOS (20/10/2026).
create table if not exists public.onichat_sync_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  project_id uuid references public.onboarding_projects(id) on delete set null,
  base_url text not null,
  account_id integer not null,
  enabled boolean not null default true,
  -- {"atendimentos": kpi_id, "vendas": kpi_id, "faturamento": kpi_id}
  kpi_map jsonb not null default '{}'::jsonb,
  -- {"label_venda": "venda", "attr_valor": "valor_contrato", "vendedor_fallback": "<salesperson_id>"}
  regras jsonb not null default '{}'::jsonb,
  api_token text,
  last_run_at timestamptz,
  last_result jsonb,
  created_at timestamptz not null default now()
);
alter table public.onichat_sync_configs enable row level security;
grant select, insert, update, delete on public.onichat_sync_configs to service_role;

-- Um lead/conversa conta uma vez por KPI (venda), igual ao dottech_kpi_events.
create table if not exists public.onichat_kpi_events (
  config_id uuid not null references public.onichat_sync_configs(id) on delete cascade,
  conversation_id bigint not null,
  kpi text not null,
  salesperson_id uuid,
  entry_date date not null,
  value numeric not null default 1,
  created_at timestamptz not null default now(),
  primary key (config_id, conversation_id, kpi)
);
alter table public.onichat_kpi_events enable row level security;
grant select, insert, update, delete on public.onichat_kpi_events to service_role;
