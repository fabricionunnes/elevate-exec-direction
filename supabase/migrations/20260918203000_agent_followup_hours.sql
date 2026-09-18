-- 18/09/2026 (Fabrício): follow-up dos agentes estava saindo de madrugada (4h). Janela própria do follow-up:
-- só envia entre followup_hour_start e followup_hour_end (Brasília). Fora dela NÃO perde o follow-up:
-- ele fica esperando e sai a partir da hora de início. Responder o lead que escreve continua 24h.
alter table public.crm_ai_agents
  add column if not exists followup_hour_start int not null default 8 check (followup_hour_start between 0 and 23),
  add column if not exists followup_hour_end int not null default 22 check (followup_hour_end between 1 and 24);
