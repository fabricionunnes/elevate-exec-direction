-- Vigia de otimização do tráfego pago (edge trafego-alertas). 20/10/2026.
-- Config por projeto (regras do planejamento + escada de verba) e log anti-spam dos avisos.
create table if not exists public.trafego_alertas_config (
  project_id uuid primary key references public.onboarding_projects(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  fones text[],                       -- quem recebe; vazio = Fabrício
  pixel_id text,                      -- pra ler Lead x LeadDesqualificado (qualificação)
  escada jsonb not null default '[]', -- [{ total, conjuntos: { "CJ1": 18, ... } }] diária em R$
  regras jsonb not null default '{}', -- sobrescreve os padrões da edge
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.trafego_alertas_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  chave text not null,
  texto text,
  dados jsonb,
  criado_em timestamptz not null default now(),
  unique (project_id, chave)
);
alter table public.trafego_alertas_config enable row level security;
alter table public.trafego_alertas_log enable row level security;
-- só a edge (service role) mexe; sem policy pra anon/authenticated

insert into public.trafego_alertas_config (project_id, nome, pixel_id, escada)
values ('ba365be1-aafe-4281-88d9-d7b11195c49e', 'Summit / Delly (Amil PME)', '1643867464129687',
  '[{"total":33,"conjuntos":{"CJ1":18,"CJ2":15}},
    {"total":45,"conjuntos":{"CJ1":25,"CJ2":20}},
    {"total":55,"conjuntos":{"CJ1":30,"CJ2":25}},
    {"total":67,"conjuntos":{"CJ1":37,"CJ2":30}}]'::jsonb)
on conflict (project_id) do nothing;
grant select, insert, update, delete on public.trafego_alertas_config, public.trafego_alertas_log to service_role;

-- cron trafego-alertas-diario (jobid 280, 9h de Brasília) foi criado direto em produção copiando o
-- header x-trafego-secret do cron 276; o segredo não fica no repositório.
