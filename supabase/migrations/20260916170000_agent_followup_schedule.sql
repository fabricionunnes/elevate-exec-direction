alter table public.crm_ai_agents add column if not exists followup_schedule jsonb not null default '[]'::jsonb;
comment on column public.crm_ai_agents.followup_schedule is 'Agenda de follow-ups: [{after_minutes:int, instruction:text|null}] — cada passo conta a partir da última mensagem enviada. Vazio = usa followup_after_minutes/followup_max_attempts.';
notify pgrst, 'reload schema';
select count(*) filter (where column_name='followup_schedule') ok from information_schema.columns where table_name='crm_ai_agents';
