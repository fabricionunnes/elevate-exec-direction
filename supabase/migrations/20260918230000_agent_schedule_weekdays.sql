-- 18/09/2026 (Fabrício): agente não pode marcar reunião em dia que não atendemos. Dias da semana permitidos
-- pra AGENDAR reunião (0=domingo … 6=sábado). Padrão: segunda a sexta.
alter table public.crm_ai_agents add column if not exists schedule_weekdays smallint[] not null default '{1,2,3,4,5}';
