alter table public.crm_ai_agent_conversation_overrides add column if not exists locked boolean not null default false;
alter table public.whatsapp_official_campaigns add column if not exists agent_id uuid references public.crm_ai_agents(id) on delete set null;
select 'ok' as migrated;
