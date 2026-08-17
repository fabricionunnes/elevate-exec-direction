-- Datacrazy → Nexus: sincronização de KPIs a partir do CRM Datacrazy.
--
-- O Datacrazy não expõe histórico de movimentação em lote (só por lead, uma
-- chamada por vez, com limite de 30 req/min). Por isso a edge `datacrazy-sync`
-- guarda uma FOTO de cada negócio (etapa/status atual) e detecta as
-- transições comparando com a foto anterior. Cada transição relevante vira um
-- evento (negócio × KPI), e os eventos são somados por (vendedor, dia) em
-- kpi_entries com a tag [DATACRAZY].
--
-- Um negócio conta UMA vez por KPI (é funil: quantos passaram por ali), na
-- data em que passou. Se ele pula etapas numa única movimentação, credita
-- também as etapas intermediárias mapeadas (chegou em "Fechado - Ganho" ⇒
-- passou por "Agendou Visita").

create table if not exists public.datacrazy_sync_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  label text,
  secret_name text not null,                 -- nome do secret com o Bearer da API
  enabled boolean not null default true,
  -- [{ "kpi_id": uuid, "kpi_name": text, "kind": "created"|"stage"|"won",
  --    "stage_ids": [uuid...], "value": null|"total",
  --    "exclude_pipelines": [uuid...] }]
  kpi_map jsonb not null default '[]'::jsonb,
  -- attendantId (Datacrazy) -> salesperson_id (Nexus). Vence o casamento por nome.
  attendant_overrides jsonb not null default '{}'::jsonb,
  -- negócios sem atendente ou com atendente não mapeado caem aqui (opcional)
  fallback_salesperson_id uuid references public.company_salespeople(id) on delete set null,
  last_run_at timestamptz,
  last_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

create table if not exists public.datacrazy_business_state (
  company_id uuid not null,
  business_id text not null,
  pipeline_id text,
  stage_id text,
  stage_index int,
  status text,
  attendant_id text,
  attendant_name text,
  total numeric not null default 0,
  created_at_dc timestamptz,
  last_moved_at timestamptz,
  status_changed_at timestamptz,
  seen_at timestamptz not null default now(),
  primary key (company_id, business_id)
);
create index if not exists datacrazy_business_state_moved_idx
  on public.datacrazy_business_state (company_id, last_moved_at desc);

create table if not exists public.datacrazy_kpi_events (
  company_id uuid not null,
  business_id text not null,
  kpi_id uuid not null,
  event_date date not null,
  salesperson_id uuid,
  value numeric not null default 1,
  source text,                                -- 'created' | 'stage:<id>' | 'won'
  created_at timestamptz not null default now(),
  primary key (company_id, business_id, kpi_id)
);
create index if not exists datacrazy_kpi_events_agg_idx
  on public.datacrazy_kpi_events (company_id, kpi_id, salesperson_id, event_date);

alter table public.datacrazy_sync_configs enable row level security;
alter table public.datacrazy_business_state enable row level security;
alter table public.datacrazy_kpi_events enable row level security;

drop policy if exists datacrazy_sync_configs_staff on public.datacrazy_sync_configs;
create policy datacrazy_sync_configs_staff on public.datacrazy_sync_configs
  for all to authenticated
  using (public.is_staff_admin_or_master())
  with check (public.is_staff_admin_or_master());

drop policy if exists datacrazy_business_state_staff on public.datacrazy_business_state;
create policy datacrazy_business_state_staff on public.datacrazy_business_state
  for select to authenticated using (public.is_staff_admin_or_master());

drop policy if exists datacrazy_kpi_events_staff on public.datacrazy_kpi_events;
create policy datacrazy_kpi_events_staff on public.datacrazy_kpi_events
  for select to authenticated using (public.is_staff_admin_or_master());

grant select, insert, update, delete on public.datacrazy_sync_configs to authenticated;
grant select on public.datacrazy_business_state, public.datacrazy_kpi_events to authenticated;
grant all on public.datacrazy_sync_configs, public.datacrazy_business_state, public.datacrazy_kpi_events to service_role;
