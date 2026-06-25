-- Monitoria ao vivo do discador (escutar/sussurrar/entrar).
-- Flag por campanha (opt-in, padrão desligado) + rastreio da conferência por ligação.

alter table public.crm_dialer_campaigns
  add column if not exists enable_monitoring boolean not null default false;

alter table public.crm_calls
  add column if not exists conference_name text;

alter table public.crm_calls
  add column if not exists agent_call_sid text;
