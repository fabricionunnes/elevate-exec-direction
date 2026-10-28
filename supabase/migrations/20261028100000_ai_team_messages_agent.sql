-- Time de IA: cada agente passa a ter a própria conversa (chat do escritório 3D fala
-- com Sophia, Luna, Mika... pelo mesmo cérebro do Max). Mensagens antigas são do Max.
alter table public.ai_team_messages add column if not exists agent_key text not null default 'orquestrador';
create index if not exists ai_team_messages_agent_idx on public.ai_team_messages (company_id, agent_key, created_at desc);
