-- 31/10/2026, Fabrício: "quando o cliente pedir pra chamar em determinado horário, já agende um follow-up
-- no horário pra seguir a conversa. Em qualquer agente." Retorno combinado com o lead: o agente grava aqui
-- (ferramenta agendar_retorno) e o cron de follow-ups envia a retomada na hora marcada.
create table if not exists public.crm_ai_agent_retornos (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  channel text not null check (channel in ('whatsapp','whatsapp_official','instagram')),
  agent_id uuid references public.crm_ai_agents(id) on delete set null,
  lead_id uuid references public.crm_leads(id) on delete set null,
  instance_id uuid,                 -- whatsapp_instances (Evolution)
  official_instance_id uuid,        -- whatsapp_official_instances (Cloud API)
  due_at timestamptz not null,
  motivo text,                      -- o que retomar (ex.: "lead pediu pra falar depois das 15h, estava em aula")
  status text not null default 'pending' check (status in ('pending','sent','cancelled','superseded','expired','failed')),
  activity_id uuid references public.crm_activities(id) on delete set null,
  created_by text not null default 'agente',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  reply text,
  erro text
);
create index if not exists crm_ai_agent_retornos_pend_idx on public.crm_ai_agent_retornos (status, due_at);
create index if not exists crm_ai_agent_retornos_conv_idx on public.crm_ai_agent_retornos (conversation_id);
alter table public.crm_ai_agent_retornos enable row level security;
drop policy if exists "staff le retornos" on public.crm_ai_agent_retornos;
create policy "staff le retornos" on public.crm_ai_agent_retornos for select to authenticated
  using (exists (select 1 from public.onboarding_staff s where s.user_id = auth.uid() and s.is_active));
grant select on public.crm_ai_agent_retornos to authenticated;
grant all on public.crm_ai_agent_retornos to service_role;
