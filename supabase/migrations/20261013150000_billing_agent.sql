-- Agente de Cobrança (Financeiro): conversa com o cliente que tem parcela em atraso.
-- Edge function: billing-agent. Pedido do Fabrício em 13/10/2026.
--
-- Esta migration cria as tabelas, o gatilho de mensagem recebida e o cron, mas NÃO liga
-- nenhum envio: billing_agent_config nasce com enabled=false e sem número configurado.
-- O agente só fala com cliente depois que alguém escolher o número do financeiro e ligar.

-- Configuração (linha única).
create table if not exists public.billing_agent_config (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  dry_run boolean not null default true,
  instance_id uuid references public.whatsapp_instances(id) on delete set null,
  owner_phone text not null default '5531989840003',
  hour_start integer not null default 9 check (hour_start between 0 and 23),
  hour_end integer not null default 18 check (hour_end between 1 and 24),
  tier_days jsonb not null default '[3, 10, 15]'::jsonb,
  max_promise_days integer not null default 7,
  max_days_overdue integer not null default 60,
  juridico_after_days integer not null default 15,
  reply_daily_cap integer not null default 8,
  consequences jsonb not null default '{"multa_juros": true, "pausa_entrega": true, "juridico": true, "negativacao": true}'::jsonb,
  model text not null default 'claude-sonnet-5',
  extra_instructions text,
  updated_at timestamptz not null default now()
);
insert into public.billing_agent_config (id) values (true) on conflict (id) do nothing;

-- Estado da cobrança por empresa.
create table if not exists public.billing_agent_cases (
  company_id uuid primary key references public.onboarding_companies(id) on delete cascade,
  phone text,
  status text not null default 'ativo' check (status in ('ativo', 'promessa', 'aguardando_decisao', 'humano', 'pausado')),
  paused_until timestamptz,
  pause_reason text,
  promise_date date,
  promises_broken integer not null default 0,
  unanswered integer not null default 0,
  last_outbound_at timestamptz,
  last_inbound_at timestamptz,
  decision_asked_at timestamptz,
  owner_instruction text,
  owner_instruction_at timestamptz,
  manual_note text,
  context_summary text,
  context_flag boolean not null default false,
  context_at timestamptz,
  cap_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_billing_agent_cases_phone on public.billing_agent_cases (phone);

-- Tudo que o agente enviou, recebeu, simulou ou deixou de enviar (e por quê).
create table if not exists public.billing_agent_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.onboarding_companies(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  kind text not null,
  status text not null,
  content text,
  phone text,
  invoice_ids uuid[],
  tier text,
  days_overdue integer,
  conversation_id uuid,
  error text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_billing_agent_messages_company on public.billing_agent_messages (company_id, created_at desc);
create index if not exists idx_billing_agent_messages_kind_day on public.billing_agent_messages (kind, created_at desc);

-- Pedidos que só o Fabrício decide (juros, desconto, como cobrar, confirmar baixa).
create table if not exists public.billing_agent_decisions (
  id uuid primary key default gen_random_uuid(),
  code integer generated always as identity,
  company_id uuid not null references public.onboarding_companies(id) on delete cascade,
  kind text not null default 'pedido' check (kind in ('pedido', 'contexto', 'baixa')),
  request text not null,
  invoice_ids uuid[],
  status text not null default 'pending' check (status in ('pending', 'answered', 'cancelled')),
  verdict text,
  answer text,
  asked_at timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists idx_billing_agent_decisions_pending on public.billing_agent_decisions (status, asked_at desc);

-- RLS: só admin e master do staff. A edge usa service_role (grant explícito, senão lê vazio sem erro).
do $$
declare t text;
begin
  foreach t in array array['billing_agent_config', 'billing_agent_cases', 'billing_agent_messages', 'billing_agent_decisions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Admins manage %s" on public.%I', t, t);
    execute format($p$create policy "Admins manage %s" on public.%I for all to authenticated
      using (exists (select 1 from public.onboarding_staff s where s.user_id = auth.uid() and s.is_active = true and s.role in ('admin', 'master')))
      with check (exists (select 1 from public.onboarding_staff s where s.user_id = auth.uid() and s.is_active = true and s.role in ('admin', 'master')))$p$, t, t);
    execute format('grant all on public.%I to service_role', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Segredo do cron e do gatilho (mesmo padrão dos outros crons: app_secrets).
insert into public.app_secrets (key, value)
select 'billing_agent_secret', encode(gen_random_bytes(24), 'hex')
where not exists (select 1 from public.app_secrets where key = 'billing_agent_secret');

-- app_secrets só é lida pelo postgres. A edge confere o segredo por esta RPC (mesmo padrão
-- de crm_webhook_dispatch_auth), sem abrir a tabela pra service_role.
create or replace function public.billing_agent_auth(p_secret text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(length(p_secret) >= 20 and exists (
    select 1 from public.app_secrets where key = 'billing_agent_secret' and value = p_secret
  ), false);
$$;
revoke all on function public.billing_agent_auth(text) from public, anon, authenticated;
grant execute on function public.billing_agent_auth(text) to service_role;

-- Mensagem recebida no número do financeiro chama o agente.
create or replace function public.billing_agent_on_wa_inbound()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance uuid;
  v_conv_instance uuid;
begin
  if new.direction is distinct from 'inbound' or new.conversation_id is null then
    return new;
  end if;
  select instance_id into v_instance from public.billing_agent_config where id = true;
  if v_instance is null then
    return new;
  end if;
  select instance_id into v_conv_instance from public.crm_whatsapp_conversations where id = new.conversation_id;
  if v_conv_instance is distinct from v_instance then
    return new;
  end if;
  perform net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/billing-agent',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-billing-agent-secret', (select value from public.app_secrets where key = 'billing_agent_secret')),
    body := jsonb_build_object('action', 'inbound', 'conversation_id', new.conversation_id, 'message_id', new.id),
    timeout_milliseconds := 30000
  );
  return new;
exception when others then
  -- o agente nunca pode impedir a gravação de uma mensagem do Atendimento
  return new;
end $$;

drop trigger if exists trg_billing_agent_on_wa_inbound on public.crm_whatsapp_messages;
create trigger trg_billing_agent_on_wa_inbound
  after insert on public.crm_whatsapp_messages
  for each row execute function public.billing_agent_on_wa_inbound();

-- Cobrança do dia: a cada 10 min. A edge decide se é dia útil e horário, e sai na hora se
-- o agente estiver desligado. Cada empresa recebe no máximo uma cobrança por dia.
select cron.unschedule(jobid) from cron.job where jobname = 'billing-agent-run';
select cron.schedule('billing-agent-run', '*/10 11-23 * * 1-5', $$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/billing-agent',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-billing-agent-secret', (select value from public.app_secrets where key = 'billing_agent_secret')),
    body := '{"action":"run"}'::jsonb,
    timeout_milliseconds := 150000
  );
$$);
