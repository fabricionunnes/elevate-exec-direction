-- Time de IA: 1 coordenador (Max) + 7 especialistas por empresa.
-- ai_team_agents    — o "quadro de funcionários" de IA da empresa (nome, papel, horário, ligado/desligado)
-- ai_team_runs      — cada rodada de cada agente (o que fez, quando, resultado)
-- ai_team_approvals — fila do dono: anúncios, posts e mensagens que a IA deixou prontos pra aprovar
-- O orquestrador (edge function ai-team-orchestrator) roda por cron de 30/30 min e também
-- sob demanda pelo botão "Rodar o time agora" na tela.

create table if not exists public.ai_team_agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  agent_key text not null
    check (agent_key in ('orquestrador','atendimento','briefing','anuncios','conteudo','reativacao','trafego','qualificacao')),
  name text not null,
  role_title text not null,
  description text,
  color text not null default '#0D2B5E',
  is_active boolean not null default true,
  -- {"hour":"08:00","days":[1,2,3,4,5,6]} — slot de 30 min em horário de Brasília; null = só sob demanda
  schedule jsonb,
  -- parâmetros do agente (oferta, público, tom, send_whatsapp...) editáveis pelo dono
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, agent_key)
);

create table if not exists public.ai_team_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  agent_key text not null,
  status text not null default 'running'
    check (status in ('running','done','skipped','error')),
  trigger text not null default 'manual'
    check (trigger in ('manual','cron')),
  -- uma frase do que o agente fez, na voz dele (aparece na timeline)
  summary text,
  output jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists ai_team_runs_company_idx
  on public.ai_team_runs (company_id, started_at desc);

create table if not exists public.ai_team_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  agent_key text not null,
  run_id uuid references public.ai_team_runs(id) on delete set null,
  kind text not null check (kind in ('ad','post','message','action')),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  decided_at timestamptz,
  decided_by uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists ai_team_approvals_pending_idx
  on public.ai_team_approvals (company_id, created_at desc) where status = 'pending';

alter table public.ai_team_agents enable row level security;
alter table public.ai_team_runs enable row level security;
alter table public.ai_team_approvals enable row level security;

-- Dono/usuários do cliente e staff da UNV com acesso à empresa.
drop policy if exists ai_team_agents_access on public.ai_team_agents;
create policy ai_team_agents_access on public.ai_team_agents for all
  using (client_has_company_access(company_id) or staff_has_company_access(company_id))
  with check (client_has_company_access(company_id) or staff_has_company_access(company_id));

drop policy if exists ai_team_runs_read on public.ai_team_runs;
create policy ai_team_runs_read on public.ai_team_runs for select
  using (client_has_company_access(company_id) or staff_has_company_access(company_id));

drop policy if exists ai_team_approvals_access on public.ai_team_approvals;
create policy ai_team_approvals_access on public.ai_team_approvals for all
  using (client_has_company_access(company_id) or staff_has_company_access(company_id))
  with check (client_has_company_access(company_id) or staff_has_company_access(company_id));

grant select, insert, update on public.ai_team_agents to authenticated;
grant select on public.ai_team_runs to authenticated;
grant select, update on public.ai_team_approvals to authenticated;
grant all on public.ai_team_agents, public.ai_team_runs, public.ai_team_approvals to service_role;

-- Monta o time padrão da empresa na primeira abertura da tela (idempotente).
create or replace function public.ai_team_seed_defaults(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare n integer;
begin
  if not (client_has_company_access(p_company_id) or staff_has_company_access(p_company_id)) then
    raise exception 'sem acesso à empresa';
  end if;

  insert into public.ai_team_agents (company_id, agent_key, name, role_title, description, color, schedule, config) values
    (p_company_id, 'orquestrador', 'Max',   'Coordenador do time',      'Distribui o trabalho entre os especialistas, consolida o que cada um fez e te entrega um briefing único.', '#0D2B5E', null, '{"send_whatsapp": false}'),
    (p_company_id, 'atendimento',  'Lia',   'Atendimento 24h',          'Responde Direct e WhatsApp a qualquer hora pelo agente de IA do CRM, qualifica e agenda.', '#CC1B1B', null, '{}'),
    (p_company_id, 'briefing',     'Bia',   'Resumo diário',            'Todo dia às 8h lê os números de ontem, compara com a média e te diz onde apertar hoje.', '#1F6FEB', '{"hour":"08:00","days":[1,2,3,4,5,6]}', '{}'),
    (p_company_id, 'anuncios',     'Rafa',  'Criador de anúncios',      'Toda segunda deixa 3 anúncios prontos (copy, CTA e público) pra você aprovar com um clique.', '#B45309', '{"hour":"08:00","days":[1]}', '{"oferta": "", "publico": "", "tom": ""}'),
    (p_company_id, 'conteudo',     'Nina',  'Conteúdo e social',        'Toda terça propõe 3 posts com gancho, legenda e formato, alinhados com a oferta da semana.', '#7C3AED', '{"hour":"08:00","days":[2]}', '{}'),
    (p_company_id, 'reativacao',   'Theo',  'Reativação de clientes',   'Toda quarta monta mensagens de reativação pra clientes e leads parados.', '#0F766E', '{"hour":"09:00","days":[3]}', '{}'),
    (p_company_id, 'trafego',      'Dudu',  'Analista de tráfego',      'Acompanha as campanhas sincronizadas da Meta e sinaliza o que está queimando verba.', '#9333EA', null, '{}'),
    (p_company_id, 'qualificacao', 'Júlia', 'Qualificação de leads',    'Pontua os leads que entram no CRM e sobe os quentes pro topo da lista do vendedor.', '#DB2777', null, '{}')
  on conflict (company_id, agent_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $fn$;

revoke execute on function public.ai_team_seed_defaults(uuid) from public, anon;
grant execute on function public.ai_team_seed_defaults(uuid) to authenticated, service_role;
