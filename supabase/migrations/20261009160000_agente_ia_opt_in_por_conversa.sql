-- Agente de IA "opt-in": só responde nas conversas que alguém ligou à mão.
-- Pedido do Fabrício (09/10/2026) pro número pessoal: a IA responde amigos, mas
-- quem decide em qual conversa ela entra é ele, conversa por conversa, no Atendimento.
-- default_enabled = true  -> comportamento de sempre (responde todo mundo do número,
--                            e o override da conversa desliga)
-- default_enabled = false -> fica desligado em toda conversa até alguém ligar o
--                            interruptor daquela conversa (override enabled = true)
alter table public.crm_ai_agents
  add column if not exists default_enabled boolean not null default true;

comment on column public.crm_ai_agents.default_enabled is
  'true = responde todas as conversas do número (padrão). false = opt-in: só responde conversas com override enabled=true.';
