-- Motor de gatilhos do Instagram (estilo ManyChat).
-- crm_ig_triggers: regras "comentou X no post Y → responde o comentário + manda DM
-- + cria/roteia lead + liga agente de IA na conversa".
-- crm_ig_trigger_runs: telemetria + dedup (1 disparo por comentário/mensagem) + cooldown.
-- Tipo 'follow' já previsto: a Meta ainda não abriu o webhook de novo seguidor pro
-- público (só parceiros, em beta) — quando abrir, é só assinar o campo e ativar.

create table if not exists public.crm_ig_triggers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  instance_id uuid not null references public.instagram_instances(id) on delete cascade,
  name text not null,
  trigger_type text not null default 'comment'
    check (trigger_type in ('comment','live_comment','mention','story_reply','dm_keyword','follow')),
  -- null/vazio = qualquer post; senão só dispara nos media_ids listados
  media_ids text[],
  -- vazio + match_type 'any' = qualquer texto
  keywords text[] not null default '{}',
  match_type text not null default 'contains'
    check (match_type in ('contains','exact','starts_with','any')),
  -- respostas públicas ao comentário (sorteia uma pra não parecer robô)
  public_replies text[] not null default '{}',
  -- DM enviada via private reply (aceita {{nome}} e {{username}})
  dm_message text,
  create_lead boolean not null default true,
  pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  stage_id uuid references public.crm_stages(id) on delete set null,
  -- agente de IA que assume a conversa depois da primeira DM
  agent_id uuid references public.crm_ai_agents(id) on delete set null,
  -- não dispara de novo pro mesmo usuário dentro da janela
  cooldown_hours integer not null default 24,
  priority integer not null default 0,
  is_active boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_ig_triggers_active_idx
  on public.crm_ig_triggers (instance_id, trigger_type) where is_active;

create table if not exists public.crm_ig_trigger_runs (
  id uuid primary key default gen_random_uuid(),
  -- sem FK de propósito: aceita id de crm_ig_triggers OU de crm_keyword_triggers
  -- (regras da aba Palavras-chave com "responder comentário" rodam na mesma engine)
  trigger_id uuid,
  instance_id uuid,
  event_type text not null,
  -- comment_id / mid da mensagem / igsid do seguidor — chave de dedup
  external_id text,
  contact_igsid text,
  contact_username text,
  media_id text,
  matched_keyword text,
  event_text text,
  public_reply_sent boolean not null default false,
  dm_sent boolean not null default false,
  lead_id uuid,
  conversation_id uuid,
  error text,
  created_at timestamptz not null default now()
);

create unique index if not exists crm_ig_trigger_runs_dedup
  on public.crm_ig_trigger_runs (trigger_id, external_id) where external_id is not null;
create index if not exists crm_ig_trigger_runs_cooldown_idx
  on public.crm_ig_trigger_runs (trigger_id, contact_igsid, created_at desc);

alter table public.crm_ig_triggers enable row level security;
alter table public.crm_ig_trigger_runs enable row level security;

drop policy if exists ig_triggers_manage on public.crm_ig_triggers;
create policy ig_triggers_manage on public.crm_ig_triggers for all
  using (exists (
    select 1 from onboarding_staff s
    where s.user_id = auth.uid() and s.role in ('master','admin','head_comercial')
  ));
drop policy if exists ig_triggers_read on public.crm_ig_triggers;
create policy ig_triggers_read on public.crm_ig_triggers for select using (has_crm_access());

drop policy if exists ig_trigger_runs_read on public.crm_ig_trigger_runs;
create policy ig_trigger_runs_read on public.crm_ig_trigger_runs for select using (has_crm_access());

grant select, insert, update, delete on public.crm_ig_triggers to authenticated;
grant select on public.crm_ig_trigger_runs to authenticated;
grant all on public.crm_ig_triggers, public.crm_ig_trigger_runs to service_role;
