-- Time de IA: conversa com o Max (chat). Uma thread por empresa, compartilhada
-- entre quem tem acesso ao time (dono, usuários do cliente, staff alocado, master).
-- Só a function ai-team-chat escreve (service role); a tela só lê.
create table if not exists public.ai_team_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  user_id uuid,
  role text not null check (role in ('user','assistant')),
  content text not null,
  -- ações que o Max executou nessa resposta: [{tool, input, result}]
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_team_messages_company_idx
  on public.ai_team_messages (company_id, created_at desc);

alter table public.ai_team_messages enable row level security;

drop policy if exists ai_team_messages_read on public.ai_team_messages;
create policy ai_team_messages_read on public.ai_team_messages for select
  using (ai_team_has_access(company_id));

grant select on public.ai_team_messages to authenticated;
grant all on public.ai_team_messages to service_role;
