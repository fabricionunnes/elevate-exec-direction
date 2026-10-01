-- ============================================================================
-- Fluxos do CRM: construtor visual de automações + motor de gatilhos
-- (item "Automações por blocos" do benchmark Datacrazy, 01/10/2026).
-- Porte do UNV Sales (migrations 0144 motor, 0154/0155 fluxos) adaptado ao Nexus.
--
-- COMO FUNCIONA
--   1. Gatilhos baratos nas tabelas do CRM só ENFILEIRAM o evento em crm_flow_events
--      (e só quando existe fluxo ativo daquele tipo). Estão na migration seguinte
--      (20261001020100), separados pra não segurar trava em crm_leads durante este arquivo.
--   2. crm_flow_tick(), no pg_cron a cada minuto, consome os eventos, retoma esperas
--      vencidas, checa resposta do lead e varre os gatilhos por tempo.
--   3. Cada lead que entra num fluxo vira um crm_flow_runs; crm_flow_advance anda bloco a
--      bloco (crm_flow_exec_node) e grava cada passo em crm_flow_run_steps.
--   4. Tudo que fala com fora (WhatsApp pro lead, WhatsApp pro time, webhook) vai pra
--      crm_flow_outbox, enviada pela edge function crm-flow-dispatch (header x-flow-secret).
--
-- DIFERENÇAS PRO UNV SALES
--   * Sem tenants/members: staff é onboarding_staff e o CRM da UNV usa tenant_id nulo
--     (as comparações de empresa são todas "is not distinct from").
--   * O Nexus já tinha crm_automations / crm_automation_runs / crm_automation_rr (regras de
--     mensagem recebida no WhatsApp). Nada disso foi tocado: aqui tudo se chama crm_flow_*.
--   * Não existe crm_message_queue: a fila é crm_flow_events, e só recebe linha quando há
--     fluxo ativo do tipo (custo zero sem fluxo).
--   * Janela de envio = horário de trabalho (crm_business_hours + crm_holidays), com
--     reserva seg a sex 08 às 18 quando a tabela está vazia.
--   * Cadência: usa as tabelas e o dispatcher que o Nexus já tem.
--
-- TRAVAS
--   * Fluxo novo nasce DESLIGADO (o gatilho de escrita força is_active = false no insert).
--   * Evento pendente há mais de 24 h expira (nunca boas-vindas atrasada); item da outbox
--     com mais de 24 h de atraso é cancelado.
--   * Importação/ação em massa (mais de 20 linhas no mesmo comando ou mais de 30 eventos
--     do mesmo tipo no mesmo minuto) marca o evento como bulk; fluxo ignora bulk, a não ser
--     que o gatilho peça include_bulk.
--   * Laço: evento gerado por fluxo carrega a profundidade; do 3º nível em diante é ignorado.
--   * Gatilho por tempo só vale pra casos que aconteceram depois de o fluxo ser ativado.
--   * Desativar o fluxo PAUSA tudo: ninguém novo entra, quem está esperando não retoma e
--     o que estava na fila de envio não sai (execução manual de teste é a exceção).
--   * Modo simulação (is_dry): percorre o fluxo inteiro sem enviar nem alterar nada.
-- ============================================================================

-- Tabelas com FK pra crm_leads pedem trava curta nela: se estiver ocupada, falha rápido em vez de enfileirar.
set local lock_timeout = '4s';

-- ---------------------------------------------------------------- tabelas
create table if not exists public.crm_flows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  name text not null,
  description text,
  is_active boolean not null default false,
  trigger_type text not null default 'manual',
  trigger_config jsonb not null default '{}'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  viewport jsonb,
  activated_at timestamptz,
  last_scan_at timestamptz,
  scan_state jsonb not null default '{}'::jsonb,   -- cursor da varredura do passado (gatilho lead parado)
  created_by uuid references public.onboarding_staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_flows_trigger_check check (trigger_type in (
    'manual', 'lead_created', 'stage_changed', 'tag_added', 'owner_changed',
    'meeting_scheduled', 'meeting_realized', 'meeting_no_show', 'lead_won', 'lead_lost',
    'lead_idle', 'activity_overdue', 'no_reply', 'lead_no_reply'))
);
alter table public.crm_flows add column if not exists scan_state jsonb not null default '{}'::jsonb;
create index if not exists crm_flows_updated_idx on public.crm_flows (updated_at desc);
create index if not exists crm_flows_active_idx on public.crm_flows (trigger_type) where is_active;

create table if not exists public.crm_flow_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  lead_id uuid not null,
  trigger_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',      -- pending | done | ignored | expired | error
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists crm_flow_events_pending_idx on public.crm_flow_events (created_at) where status = 'pending';
create index if not exists crm_flow_events_created_idx on public.crm_flow_events (created_at);

create table if not exists public.crm_flow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  flow_id uuid not null references public.crm_flows(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'waiting', 'done', 'failed', 'cancelled')),
  current_node_id text,
  wait_kind text,                 -- delay | reply | webhook
  wait_since timestamptz,
  resume_at timestamptz,          -- delay: quando volta; reply/webhook: quando estoura
  context jsonb not null default '{}'::jsonb,
  trigger_type text,
  dedupe_key text,
  depth int not null default 1,
  is_dry boolean not null default false,
  steps int not null default 0,
  error text,
  started_by uuid,
  started_at timestamptz not null default clock_timestamp(),   -- vários runs no mesmo ciclo: mantém a ordem
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.crm_flow_runs alter column started_at set default clock_timestamp();
create unique index if not exists crm_flow_runs_dedupe_idx on public.crm_flow_runs (dedupe_key) where dedupe_key is not null;
create index if not exists crm_flow_runs_flow_idx on public.crm_flow_runs (flow_id, started_at desc);
create index if not exists crm_flow_runs_lead_idx on public.crm_flow_runs (lead_id, started_at desc);
create index if not exists crm_flow_runs_due_idx on public.crm_flow_runs (resume_at) where status = 'waiting';
create index if not exists crm_flow_runs_started_idx on public.crm_flow_runs (started_at desc);

create table if not exists public.crm_flow_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.crm_flow_runs(id) on delete cascade,
  node_id text,
  node_type text,
  status text not null default 'ok',   -- ok | wait | skip | error
  detail jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists crm_flow_run_steps_run_idx on public.crm_flow_run_steps (run_id, created_at);

create table if not exists public.crm_flow_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  kind text not null check (kind in ('lead_whatsapp', 'staff_whatsapp', 'webhook')),
  lead_id uuid,
  flow_id uuid references public.crm_flows(id) on delete cascade,
  run_id uuid references public.crm_flow_runs(id) on delete cascade,
  node_id text,
  payload jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts int not null default 0,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_flow_outbox_due_idx on public.crm_flow_outbox (scheduled_at) where status = 'pending';
create index if not exists crm_flow_outbox_run_idx on public.crm_flow_outbox (run_id);
create index if not exists crm_flow_outbox_flow_idx on public.crm_flow_outbox (flow_id, created_at desc);

-- ponteiro do rodízio por bloco
create table if not exists public.crm_flow_rr (
  flow_id uuid not null references public.crm_flows(id) on delete cascade,
  node_id text not null,
  last_staff_id uuid,
  primary key (flow_id, node_id)
);

-- ---------------------------------------------------------------- permissões
-- Mesma régua do menu (canSettings no CRMLayout): master, admin e head comercial editam.
create or replace function public.crm_flow_can_edit()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from onboarding_staff
                  where user_id = auth.uid() and is_active and role in ('master', 'admin', 'head_comercial'));
$$;
grant execute on function public.crm_flow_can_edit() to authenticated, service_role;

alter table public.crm_flows enable row level security;
alter table public.crm_flow_events enable row level security;
alter table public.crm_flow_runs enable row level security;
alter table public.crm_flow_run_steps enable row level security;
alter table public.crm_flow_outbox enable row level security;
alter table public.crm_flow_rr enable row level security;   -- só o motor mexe

drop policy if exists crm_flows_read on public.crm_flows;
create policy crm_flows_read on public.crm_flows for select to authenticated
  using (public.get_current_staff_id() is not null and public.tenant_matches(tenant_id));
drop policy if exists crm_flows_write on public.crm_flows;
create policy crm_flows_write on public.crm_flows for all to authenticated
  using (public.crm_flow_can_edit() and public.tenant_matches(tenant_id))
  with check (public.crm_flow_can_edit() and public.tenant_matches(tenant_id));

-- Execuções: quem edita fluxo vê todas; vendedor só as dos leads dele (o CRM já esconde lead de outro dono)
drop policy if exists crm_flow_runs_read on public.crm_flow_runs;
create policy crm_flow_runs_read on public.crm_flow_runs for select to authenticated
  using (public.tenant_matches(tenant_id) and (public.crm_flow_can_edit()
         or exists (select 1 from public.crm_leads l where l.id = lead_id and l.owner_staff_id = public.get_current_staff_id())));
drop policy if exists crm_flow_run_steps_read on public.crm_flow_run_steps;
create policy crm_flow_run_steps_read on public.crm_flow_run_steps for select to authenticated
  using (exists (select 1 from public.crm_flow_runs r where r.id = run_id));
drop policy if exists crm_flow_outbox_read on public.crm_flow_outbox;
create policy crm_flow_outbox_read on public.crm_flow_outbox for select to authenticated
  using (public.crm_flow_can_edit() and public.tenant_matches(tenant_id));
drop policy if exists crm_flow_events_read on public.crm_flow_events;
create policy crm_flow_events_read on public.crm_flow_events for select to authenticated
  using (public.crm_flow_can_edit() and public.tenant_matches(tenant_id));

revoke all on public.crm_flows, public.crm_flow_events, public.crm_flow_runs, public.crm_flow_run_steps,
              public.crm_flow_outbox, public.crm_flow_rr from anon;
revoke all on public.crm_flow_events, public.crm_flow_runs, public.crm_flow_run_steps,
              public.crm_flow_outbox, public.crm_flow_rr from authenticated;
grant select, insert, update, delete on public.crm_flows to authenticated;
grant select on public.crm_flow_events, public.crm_flow_runs, public.crm_flow_run_steps, public.crm_flow_outbox to authenticated;
grant all on public.crm_flows, public.crm_flow_events, public.crm_flow_runs, public.crm_flow_run_steps,
             public.crm_flow_outbox, public.crm_flow_rr to service_role;

-- Fluxo novo nasce desligado; ativar marca activated_at (referência do "só daqui pra frente");
-- updated_at só anda quando o conteúdo muda (o motor grava last_scan_at sem sujar a lista).
create or replace function public.crm_flows_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.tenant_id is null then new.tenant_id := public.current_user_tenant_id(); end if;
    if new.created_by is null then new.created_by := public.get_current_staff_id(); end if;
    new.is_active := false;
    new.activated_at := null;
    new.last_scan_at := null;
    new.scan_state := '{}'::jsonb;
    new.updated_at := now();
    return new;
  end if;
  if (new.name, new.description, new.trigger_type, new.trigger_config, new.filters, new.nodes, new.edges, new.is_active)
     is distinct from
     (old.name, old.description, old.trigger_type, old.trigger_config, old.filters, old.nodes, old.edges, old.is_active) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  -- ligou agora, ou mexeu no gatilho com o fluxo ligado: a régua do "só daqui pra frente" recomeça
  if new.is_active and (not old.is_active
       or new.trigger_type is distinct from old.trigger_type
       or new.trigger_config is distinct from old.trigger_config) then
    new.activated_at := now();
    new.last_scan_at := null;
    new.scan_state := '{}'::jsonb;
  end if;
  return new;
end $$;
drop trigger if exists trg_crm_flows_before_write on public.crm_flows;
create trigger trg_crm_flows_before_write before insert or update on public.crm_flows
  for each row execute function public.crm_flows_before_write();

-- ---------------------------------------------------------------- utilidades
create or replace function public.crm_flow_depth()
returns int language sql stable as $$
  select coalesce(nullif(current_setting('crm.flow_depth', true), '')::int, 0)
$$;

-- Próximo instante dentro do horário de trabalho (Configurações do CRM > Horário de Trabalho).
-- Já está dentro: devolve o próprio instante. Tabela vazia: seg a sex, 08 às 18 (Brasília).
create or replace function public.crm_flow_window_next(_ts timestamptz)
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare
  _local timestamp := _ts at time zone 'America/Sao_Paulo';
  _d date := _local::date;
  _i int; _has boolean; _open boolean; _o time; _c time;
begin
  select exists (select 1 from crm_business_hours) into _has;
  for _i in 0..14 loop
    if _has then
      select h.is_open, h.open_time, h.close_time into _open, _o, _c
        from crm_business_hours h where h.weekday = extract(dow from (_d + _i))::int;
      if not found then _open := false; end if;
    else
      _open := extract(dow from (_d + _i)) between 1 and 5; _o := '08:00'; _c := '18:00';
    end if;
    continue when not coalesce(_open, false) or _o >= _c;
    continue when exists (select 1 from crm_holidays f where f.date = _d + _i);
    if _i = 0 then
      if _local::time >= _o and _local::time < _c then return _ts; end if;
      if _local::time < _o then return (_d + _o) at time zone 'America/Sao_Paulo'; end if;
    else
      return ((_d + _i) + _o) at time zone 'America/Sao_Paulo';
    end if;
  end loop;
  return _ts;
end $$;

-- "1.234,56", "R$ 1234.5", "12" -> número
create or replace function public.crm_flow_num(_t text)
returns numeric language plpgsql immutable as $$
declare _s text := coalesce(_t, '');
begin
  if position(',' in _s) > 0 then _s := replace(replace(_s, '.', ''), ',', '.'); end if;
  _s := regexp_replace(_s, '[^0-9.\-]', '', 'g');
  if _s in ('', '-', '.') then return null; end if;
  return _s::numeric;
exception when others then return null;
end $$;

create or replace function public.crm_flow_money(_v numeric)
returns text language sql immutable as $$
  select case when _v is null then '' else
    'R$ ' || replace(replace(replace(to_char(_v, 'FM999,999,999,990.00'), ',', '#'), '.', ','), '#', '.') end
$$;

-- Última mensagem recebida do lead desde _since (pela conversa vinculada)
create or replace function public.crm_flow_last_inbound(_lead uuid, _since timestamptz)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(m.created_at)
    from crm_whatsapp_conversations c
    join crm_whatsapp_messages m on m.conversation_id = c.id
   where c.lead_id = _lead and m.direction = 'inbound'
     and m.created_at > coalesce(_since, now() - interval '365 days')
$$;

-- Último movimento do lead: entrada na etapa, atividade concluída ou mensagem na conversa
create or replace function public.crm_flow_lead_touch(_lead uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select greatest(l.stage_entered_at, l.last_activity_at,
                  (select max(c.last_message_at) from crm_whatsapp_conversations c where c.lead_id = l.id))
    from crm_leads l where l.id = _lead
$$;

create or replace function public.crm_flow_node(_flow public.crm_flows, _node_id text)
returns jsonb language sql immutable as $$
  select n from jsonb_array_elements(_flow.nodes) n where n->>'id' = _node_id limit 1;
$$;

-- próximo bloco a partir de um bloco e de uma saída: default, yes/no, a/b, replied/timeout
create or replace function public.crm_flow_next(_flow public.crm_flows, _node_id text, _handle text default 'default')
returns text language sql immutable as $$
  select e->>'target' from jsonb_array_elements(_flow.edges) e
   where e->>'source' = _node_id
     and coalesce(nullif(e->>'sourceHandle', ''), 'default') = coalesce(_handle, 'default')
   limit 1;
$$;

-- Troca {variavel} e {{variavel}} pelos dados do lead e pelas variáveis do fluxo.
-- _json = true escapa o valor pra caber dentro de uma string JSON (corpo de webhook).
create or replace function public.crm_flow_render(_tpl text, _lead uuid, _ctx jsonb default '{}'::jsonb, _json boolean default false)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  _out text := coalesce(_tpl, '');
  _l record; _m record; _v jsonb; _k text; _val text; _nome text;
begin
  if position('{' in _out) = 0 then return _out; end if;
  select l.id, l.name, l.phone, l.email, l.company, l.city, l.state, l.segment, l.opportunity_value,
         p.name as pipeline, s.name as stage, st.name as owner, coalesce(o.name, l.origin) as origin
    into _l
    from crm_leads l
    left join crm_pipelines p on p.id = l.pipeline_id
    left join crm_stages s on s.id = l.stage_id
    left join onboarding_staff st on st.id = l.owner_staff_id
    left join crm_origins o on o.id = l.origin_id
   where l.id = _lead;
  _nome := btrim(coalesce(_l.name, ''));
  _v := jsonb_build_object(
    'primeiro_nome', split_part(_nome, ' ', 1), 'nome', _nome, 'lead_name', _nome, 'nome_completo', _nome,
    'telefone', coalesce(_l.phone, ''), 'lead_phone', coalesce(_l.phone, ''),
    'email', coalesce(_l.email, ''), 'lead_email', coalesce(_l.email, ''),
    'empresa', coalesce(_l.company, ''), 'company_name', coalesce(_l.company, ''),
    'funil', coalesce(_l.pipeline, ''), 'pipeline_name', coalesce(_l.pipeline, ''),
    'etapa', coalesce(_l.stage, ''), 'stage_name', coalesce(_l.stage, ''),
    'responsavel', coalesce(_l.owner, ''), 'responsible_name', coalesce(_l.owner, ''),
    'valor', crm_flow_money(_l.opportunity_value), 'origem', coalesce(_l.origin, ''),
    'cidade', coalesce(_l.city, ''), 'estado', coalesce(_l.state, ''), 'segmento', coalesce(_l.segment, ''),
    'link_lead', case when _l.id is null then '' else 'https://unvholdings.com.br/#/crm/leads/' || _l.id end,
    'data_hoje', to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
    'hora_agora', to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI'));
  if _out ~* 'reuniao|meeting' and _lead is not null then
    select a.scheduled_at, a.meeting_link into _m from crm_activities a
     where a.lead_id = _lead and a.type = 'meeting' and a.status = 'pending' and a.scheduled_at >= now() - interval '2 hours'
     order by a.scheduled_at limit 1;
    _v := _v || jsonb_build_object(
      'data_reuniao', coalesce(to_char(_m.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), ''),
      'hora_reuniao', coalesce(to_char(_m.scheduled_at at time zone 'America/Sao_Paulo', 'HH24:MI'), ''),
      'link_reuniao', coalesce(_m.meeting_link, ''),
      'meeting_date', coalesce(to_char(_m.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), ''),
      'meeting_time', coalesce(to_char(_m.scheduled_at at time zone 'America/Sao_Paulo', 'HH24:MI'), ''),
      'meeting_link', coalesce(_m.meeting_link, ''));
  end if;
  -- variáveis do fluxo (bloco Operação de campo, Fórmula, resposta de webhook, dados do gatilho)
  if _ctx is not null and jsonb_typeof(_ctx->'vars') = 'object' then _v := _v || (_ctx->'vars'); end if;
  for _k, _val in select key, value #>> '{}' from jsonb_each(_v) loop
    _val := coalesce(_val, '');
    if _json then _val := to_json(_val)::text; _val := substr(_val, 2, length(_val) - 2); end if;
    _out := replace(_out, '{{' || _k || '}}', _val);
    _out := replace(_out, '{' || _k || '}', _val);
    _out := replace(_out, '{ctx.' || _k || '}', _val);
  end loop;
  return _out;
end $$;

-- Valor de um campo do lead pra condições e operações
create or replace function public.crm_flow_field(_lead uuid, _field text, _ctx jsonb default '{}'::jsonb)
returns text language plpgsql stable security definer set search_path = public as $$
declare _l record; _agora timestamp := now() at time zone 'America/Sao_Paulo';
begin
  if _field like 'ctx.%' then return coalesce(_ctx->'vars'->>substr(_field, 5), ''); end if;
  if _field = 'now_hour' then return extract(hour from _agora)::int::text; end if;
  if _field = 'now_weekday' then return extract(dow from _agora)::int::text; end if;
  if _field = 'now_time' then return to_char(_agora, 'HH24:MI'); end if;
  if _field = 'in_business_hours' then return (crm_flow_window_next(now()) = now())::text; end if;
  select l.*, s.name as stage_name, s.final_type, p.name as pipeline_name, o.name as origin_name, st.name as owner_name
    into _l from crm_leads l
    left join crm_stages s on s.id = l.stage_id
    left join crm_pipelines p on p.id = l.pipeline_id
    left join crm_origins o on o.id = l.origin_id
    left join onboarding_staff st on st.id = l.owner_staff_id
   where l.id = _lead;
  if not found then return null; end if;
  return case _field
    when 'name' then _l.name when 'phone' then _l.phone when 'email' then _l.email when 'company' then _l.company
    when 'city' then _l.city when 'state' then _l.state when 'segment' then _l.segment when 'role' then _l.role
    when 'origin' then coalesce(_l.origin_name, _l.origin) when 'origin_id' then _l.origin_id::text when 'origin_name' then coalesce(_l.origin_name, _l.origin)
    when 'opportunity_value' then _l.opportunity_value::text when 'probability' then _l.probability::text
    when 'fit_score' then _l.fit_score::text
    when 'stage_id' then _l.stage_id::text when 'stage_name' then _l.stage_name
    when 'pipeline_id' then _l.pipeline_id::text when 'pipeline_name' then _l.pipeline_name
    when 'owner_staff_id' then _l.owner_staff_id::text when 'owner_name' then _l.owner_name
    when 'sdr_staff_id' then _l.sdr_staff_id::text when 'closer_staff_id' then _l.closer_staff_id::text
    when 'urgency' then _l.urgency when 'main_pain' then _l.main_pain when 'notes' then _l.notes
    when 'estimated_revenue' then _l.estimated_revenue when 'employee_count' then _l.employee_count
    when 'instagram' then _l.instagram when 'document' then _l.document when 'trade_name' then _l.trade_name
    when 'utm_source' then _l.utm_source when 'utm_medium' then _l.utm_medium when 'utm_campaign' then _l.utm_campaign
    when 'utm_content' then _l.utm_content when 'campaign_name' then _l.campaign_name when 'ad_name' then _l.ad_name
    when 'days_in_stage' then floor(extract(epoch from (now() - coalesce(_l.stage_entered_at, _l.created_at))) / 86400)::text
    when 'days_since_created' then floor(extract(epoch from (now() - _l.created_at)) / 86400)::text
    when 'hours_since_last_inbound' then (select floor(extract(epoch from (now() - x)) / 3600)::text from crm_flow_last_inbound(_lead, null) x)
    when 'is_won' then (coalesce(_l.final_type, '') = 'won')::text
    when 'is_lost' then (coalesce(_l.final_type, '') = 'lost')::text
    when 'tags_count' then (select count(*)::text from crm_lead_tags where lead_id = _lead)
    else null end;
end $$;

-- Uma regra de condição: {field, op, value}
create or replace function public.crm_flow_rule_ok(_lead uuid, _rule jsonb, _ctx jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare _f text := _rule->>'field'; _op text := coalesce(_rule->>'op', 'equals'); _val text := coalesce(_rule->>'value', '');
        _cur text; _n numeric; _m numeric;
begin
  if _f = 'has_tag' then
    return exists (select 1 from crm_lead_tags where lead_id = _lead and tag_id = nullif(_val, '')::uuid) = (_op <> 'not');
  end if;
  if _f = 'in_cadence' then
    return exists (select 1 from crm_cadence_enrollments where lead_id = _lead and status = 'active'
                     and (nullif(_val, '') is null or cadence_id = _val::uuid)) = (_op <> 'not');
  end if;
  if _f = 'replied_since' then
    return (crm_flow_last_inbound(_lead, now() - make_interval(hours => greatest(coalesce(nullif(_val, '')::int, 24), 1))) is not null) = (_op <> 'not');
  end if;
  _cur := crm_flow_field(_lead, _f, _ctx);
  case _op
    when 'equals' then return lower(coalesce(_cur, '')) = lower(_val);
    when 'not_equals' then return lower(coalesce(_cur, '')) <> lower(_val);
    when 'contains' then return position(lower(_val) in lower(coalesce(_cur, ''))) > 0;
    when 'not_contains' then return position(lower(_val) in lower(coalesce(_cur, ''))) = 0;
    when 'starts_with' then return lower(coalesce(_cur, '')) like lower(_val) || '%';
    when 'is_empty' then return coalesce(_cur, '') = '';
    when 'not_empty' then return coalesce(_cur, '') <> '';
    when 'in' then return lower(coalesce(_cur, '')) = any (select lower(trim(x)) from unnest(string_to_array(_val, ',')) x);
    when 'gt', 'gte', 'lt', 'lte' then
      if _f = 'now_time' then
        _n := extract(epoch from _cur::time); _m := extract(epoch from _val::time);
      else
        _n := crm_flow_num(_cur); _m := crm_flow_num(_val);
      end if;
      if _n is null or _m is null then return false; end if;
      return case _op when 'gt' then _n > _m when 'gte' then _n >= _m when 'lt' then _n < _m else _n <= _m end;
    when 'is_true' then return coalesce(_cur, '') = 'true';
    when 'is_false', 'not' then return coalesce(_cur, '') <> 'true';
    else return false;
  end case;
exception when others then return false;
end $$;

create or replace function public.crm_flow_condition_ok(_lead uuid, _cfg jsonb, _ctx jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare _r jsonb; _all boolean := coalesce(_cfg->>'logic', 'and') = 'and'; _ok boolean; _n int := 0;
begin
  for _r in select * from jsonb_array_elements(coalesce(_cfg->'rules', '[]'::jsonb)) loop
    _n := _n + 1;
    _ok := crm_flow_rule_ok(_lead, _r, _ctx);
    if _all and not _ok then return false; end if;
    if not _all and _ok then return true; end if;
  end loop;
  if _n = 0 then return true; end if;
  return _all;
end $$;

-- Filtros de entrada do fluxo contra o lead
create or replace function public.crm_flow_filters_match(_f jsonb, _lead uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare _pipe uuid; _stage uuid; _origin uuid; _valor numeric; _owner uuid;
begin
  if _f is null or _f = '{}'::jsonb then return true; end if;
  select pipeline_id, stage_id, origin_id, opportunity_value, owner_staff_id
    into _pipe, _stage, _origin, _valor, _owner from crm_leads where id = _lead;
  if not found then return false; end if;
  if nullif(_f->>'pipeline_id', '') is not null and _pipe is distinct from (_f->>'pipeline_id')::uuid then return false; end if;
  if nullif(_f->>'stage_id', '') is not null and _stage is distinct from (_f->>'stage_id')::uuid then return false; end if;
  if nullif(_f->>'origin_id', '') is not null and _origin is distinct from (_f->>'origin_id')::uuid then return false; end if;
  if nullif(_f->>'owner_staff_id', '') is not null and _owner is distinct from (_f->>'owner_staff_id')::uuid then return false; end if;
  if nullif(_f->>'tag_id', '') is not null and not exists (
       select 1 from crm_lead_tags where lead_id = _lead and tag_id = (_f->>'tag_id')::uuid) then return false; end if;
  if nullif(_f->>'min_value', '') is not null and coalesce(_valor, 0) < crm_flow_num(_f->>'min_value') then return false; end if;
  return true;
end $$;

-- Pessoas-alvo de um bloco: dono do lead, gestores, pessoas fixas ou rodízio.
-- _peek = true não anda o ponteiro do rodízio (simulação).
create or replace function public.crm_flow_people(_tenant uuid, _owner uuid, _cfg jsonb, _flow uuid, _node text, _peek boolean default false)
returns uuid[] language plpgsql volatile security definer set search_path = public as $$
declare _mode text := coalesce(nullif(_cfg->>'assignee_mode', ''), nullif(_cfg->>'to', ''), 'owner');
        _ids uuid[]; _pool uuid[]; _last uuid; _pos int;
begin
  if _mode = 'owner' then
    return case when _owner is null or not exists (select 1 from onboarding_staff where id = _owner and is_active)
                then '{}'::uuid[] else array[_owner] end;
  end if;
  if _mode = 'managers' then
    select coalesce(array_agg(id order by name), '{}') into _ids from onboarding_staff
     where is_active and tenant_id is not distinct from _tenant and role in ('master', 'admin', 'head_comercial');
    return _ids;
  end if;
  select coalesce(array_agg(x::uuid), '{}') into _ids
    from jsonb_array_elements_text(coalesce(_cfg->'staff_ids', '[]'::jsonb)) x;
  select coalesce(array_agg(s.id order by array_position(_ids, s.id)), '{}') into _pool
    from onboarding_staff s where s.id = any(_ids) and s.is_active and s.tenant_id is not distinct from _tenant;
  if array_length(_pool, 1) is null then return '{}'::uuid[]; end if;
  if _mode = 'round_robin' then
    select last_staff_id into _last from crm_flow_rr where flow_id = _flow and node_id = _node;
    _pos := coalesce(array_position(_pool, _last), 0) + 1;
    if _pos > array_length(_pool, 1) then _pos := 1; end if;
    if not _peek then
      insert into crm_flow_rr (flow_id, node_id, last_staff_id) values (_flow, _node, _pool[_pos])
      on conflict (flow_id, node_id) do update set last_staff_id = excluded.last_staff_id;
    end if;
    return array[_pool[_pos]];
  end if;
  return _pool;  -- fixed
end $$;

-- Inscreve o lead numa cadência do Nexus (mesma regra do gatilho crm_cadence_auto_enroll)
create or replace function public.crm_flow_cadence_enroll(_cadence uuid, _lead uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare _c record; _s record; _e record; _next timestamptz; _tenant uuid;
begin
  select id, is_active into _c from crm_cadences where id = _cadence;
  if not found or not _c.is_active then return false; end if;
  select id, delay_value, delay_unit into _s from crm_cadence_steps
   where cadence_id = _cadence and is_active order by sort_order limit 1;
  if not found then return false; end if;
  _next := crm_cadence_calc_next_run(now(), _s.delay_value, _s.delay_unit);
  select tenant_id into _tenant from crm_leads where id = _lead;
  select id, status into _e from crm_cadence_enrollments where cadence_id = _cadence and lead_id = _lead limit 1;
  if not found then
    insert into crm_cadence_enrollments (cadence_id, lead_id, current_step_index, status, next_run_at, tenant_id)
    values (_cadence, _lead, 0, 'active', _next, _tenant);
    return true;
  elsif _e.status not in ('active', 'paused') then
    update crm_cadence_enrollments
       set current_step_index = 0, status = 'active', next_run_at = _next, completed_at = null,
           stopped_reason = null, enrolled_at = now(), updated_at = now()
     where id = _e.id;
    return true;
  end if;
  return false;
end $$;

-- Formatações do bloco Operação de campo
create or replace function public.crm_flow_transform(_val text, _how text)
returns text language plpgsql immutable as $$
declare _d text; _ts timestamp;
begin
  case coalesce(_how, 'none')
    when 'upper' then return upper(_val);
    when 'lower' then return lower(_val);
    when 'trim' then return btrim(regexp_replace(_val, '\s+', ' ', 'g'));
    when 'capitalize' then return initcap(lower(_val));
    when 'digits' then return regexp_replace(_val, '\D', '', 'g');
    when 'first_word' then return split_part(btrim(_val), ' ', 1);
    when 'number' then return coalesce(crm_flow_num(_val)::text, '');
    when 'phone_br', 'phone_mask' then
      _d := regexp_replace(_val, '\D', '', 'g');
      _d := regexp_replace(_d, '^0+', '');
      if length(_d) in (12, 13) and left(_d, 2) = '55' then _d := substr(_d, 3); end if;
      if length(_d) not in (10, 11) then return _val; end if;
      if _how = 'phone_br' then return '55' || _d; end if;
      return '(' || left(_d, 2) || ') ' || substr(_d, 3, length(_d) - 6) || '-' || right(_d, 4);
    when 'date_br', 'date_iso' then
      if _val ~ '^\s*\d{1,2}/\d{1,2}/\d{4}' then _ts := to_date(substring(_val from '\d{1,2}/\d{1,2}/\d{4}'), 'DD/MM/YYYY');
      else _ts := _val::timestamp; end if;
      return case when _how = 'date_br' then to_char(_ts, 'DD/MM/YYYY') else to_char(_ts, 'YYYY-MM-DD') end;
    else return _val;
  end case;
exception when others then return _val;
end $$;

-- ---------------------------------------------------------------- executar um bloco
-- Devolve {"next": saída, "wait": {...} | null, "detail": {...}}
create or replace function public.crm_flow_exec_node(_run public.crm_flow_runs, _flow public.crm_flows, _node jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  _t text := _node->>'type'; _c jsonb := coalesce(_node->'data', '{}'::jsonb); _nid text := _node->>'id';
  _lead uuid := _run.lead_id; _tenant uuid := _flow.tenant_id; _ctx jsonb := _run.context; _dry boolean := _run.is_dry;
  _owner uuid; _people uuid[]; _p uuid; _txt text; _title text; _lead_name text; _stage uuid; _pipe uuid;
  _val text; _n numeric; _m numeric; _num numeric; _field text; _resume timestamptz; _hh text; _type text;
  _body text; _fields jsonb; _when timestamptz; _ok boolean; _x jsonb;
begin
  select owner_staff_id, name into _owner, _lead_name from crm_leads where id = _lead;
  _lead_name := coalesce(_lead_name, 'Contato');

  if _t in ('trigger', 'end', 'note') then
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('tipo', _t));

  elsif _t = 'condition' then
    if crm_flow_condition_ok(_lead, _c, _ctx) then
      return jsonb_build_object('next', 'yes', 'detail', jsonb_build_object('resultado', 'sim'));
    end if;
    return jsonb_build_object('next', 'no', 'detail', jsonb_build_object('resultado', 'não'));

  elsif _t = 'split' then
    _num := coalesce(crm_flow_num(_c->>'percent_a'), 50);
    if random() * 100 < _num then
      return jsonb_build_object('next', 'a', 'detail', jsonb_build_object('lado', 'A'));
    end if;
    return jsonb_build_object('next', 'b', 'detail', jsonb_build_object('lado', 'B'));

  elsif _t = 'wait' then
    if coalesce(_c->>'mode', 'duration') = 'business' then
      _resume := crm_flow_window_next(now());
    elsif coalesce(_c->>'mode', 'duration') = 'time' then
      _hh := coalesce(nullif(_c->>'until_time', ''), '09:00');
      _resume := ((now() at time zone 'America/Sao_Paulo')::date + _hh::time) at time zone 'America/Sao_Paulo';
      if _resume <= now() then _resume := _resume + interval '1 day'; end if;
    else
      _resume := now() + case coalesce(_c->>'unit', 'minutes')
        when 'minutes' then make_interval(mins => greatest(coalesce(nullif(_c->>'value', '')::int, 5), 0))
        when 'hours' then make_interval(hours => greatest(coalesce(nullif(_c->>'value', '')::int, 1), 0))
        else make_interval(days => greatest(coalesce(nullif(_c->>'value', '')::int, 1), 0)) end;
    end if;
    if coalesce((_c->>'respect_window')::boolean, false) then _resume := crm_flow_window_next(_resume); end if;
    if _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('simulado', true, 'ate', _resume));
    end if;
    if _resume <= now() then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('resultado', 'já está no horário, seguiu direto'));
    end if;
    return jsonb_build_object('next', 'default', 'wait', jsonb_build_object('kind', 'delay', 'resume_at', _resume),
                              'detail', jsonb_build_object('ate', _resume));

  elsif _t = 'wait_reply' then
    _resume := now() + make_interval(hours => greatest(coalesce(nullif(_c->>'hours', '')::int, 24), 1));
    if _dry then
      return jsonb_build_object('next', 'timeout', 'detail', jsonb_build_object('simulado', true, 'estoura_em', _resume,
                                'resultado', 'na simulação segue por Não respondeu'));
    end if;
    return jsonb_build_object('next', 'default', 'wait', jsonb_build_object('kind', 'reply', 'resume_at', _resume),
                              'detail', jsonb_build_object('estoura_em', _resume));

  elsif _t = 'send_whatsapp' then
    _txt := crm_flow_render(_c->>'message', _lead, _ctx);
    _when := case when coalesce((_c->>'respect_window')::boolean, true) then crm_flow_window_next(now()) else now() end;
    if btrim(_txt) = '' then
      return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'mensagem vazia'));
    end if;
    if _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('simulado', true, 'mensagem', _txt, 'envio_em', _when));
    end if;
    insert into crm_flow_outbox (tenant_id, kind, lead_id, flow_id, run_id, node_id, payload, scheduled_at)
    values (_tenant, 'lead_whatsapp', _lead, _flow.id, _run.id, _nid, jsonb_build_object(
      'message', _txt,
      'instance_mode', coalesce(nullif(_c->>'instance_mode', ''), 'conversation'),
      'instance_kind', coalesce(nullif(_c->>'instance_kind', ''), 'evolution'),
      'instance_id', nullif(_c->>'instance_id', ''),
      'manual', _run.trigger_type = 'manual'), _when);
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('resultado', 'na fila de envio', 'mensagem', _txt, 'envio_em', _when));

  elsif _t = 'create_task' then
    _title := crm_flow_render(coalesce(nullif(_c->>'title', ''), _flow.name), _lead, _ctx);
    _type := coalesce(nullif(_c->>'activity_type', ''), 'followup');
    if _type not in ('call', 'whatsapp', 'email', 'meeting', 'followup', 'proposal', 'other', 'note') then _type := 'followup'; end if;
    _people := crm_flow_people(_tenant, _owner, _c, _flow.id, _nid, _dry);
    _when := now() + make_interval(days => coalesce(nullif(_c->>'days', '')::int, 0), hours => coalesce(nullif(_c->>'hours', '')::int, 0));
    if _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('simulado', true, 'tarefa', _title, 'pessoas', to_jsonb(_people), 'para', _when));
    end if;
    if array_length(_people, 1) is null then _people := array[null::uuid]; end if;
    foreach _p in array _people loop
      insert into crm_activities (lead_id, type, title, description, scheduled_at, status, responsible_staff_id, is_automation, automation_config)
      values (_lead, _type, _title, nullif(crm_flow_render(_c->>'description', _lead, _ctx), ''), _when, 'pending', _p, false,
              jsonb_build_object('source', 'flow', 'flow_id', _flow.id, 'run_id', _run.id));
      if _p is not null and coalesce((_c->>'notify')::boolean, true) then
        insert into onboarding_notifications (staff_id, type, title, message, reference_id, reference_type, is_read)
        values (_p, 'task_assigned', 'Nova tarefa automática', format('%s: "%s" no lead %s.', _flow.name, _title, _lead_name), _lead, 'crm_lead', false);
      end if;
    end loop;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('tarefa', _title, 'pessoas', to_jsonb(_people), 'para', _when));

  elsif _t = 'notify' then
    _people := crm_flow_people(_tenant, _owner, _c, _flow.id, _nid, _dry);
    _txt := crm_flow_render(coalesce(nullif(_c->>'message', ''), _flow.name || ': {lead_name}'), _lead, _ctx);
    if _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('simulado', true, 'pessoas', to_jsonb(coalesce(_people, '{}'::uuid[])), 'mensagem', _txt, 'canal', coalesce(nullif(_c->>'channel', ''), 'app')));
    end if;
    foreach _p in array coalesce(_people, '{}'::uuid[]) loop
      if coalesce(nullif(_c->>'channel', ''), 'app') in ('app', 'both') then
        insert into onboarding_notifications (staff_id, type, title, message, reference_id, reference_type, is_read)
        values (_p, 'crm_flow', _flow.name, _txt, _lead, 'crm_lead', false);
      end if;
      if coalesce(nullif(_c->>'channel', ''), 'app') in ('whatsapp', 'both') then
        insert into crm_flow_outbox (tenant_id, kind, lead_id, flow_id, run_id, node_id, payload)
        values (_tenant, 'staff_whatsapp', _lead, _flow.id, _run.id, _nid, jsonb_build_object(
          'staff_id', _p, 'message', format(E'*%s*\n\n%s', _flow.name, _txt),
          'instance_id', nullif(_c->>'instance_id', ''), 'manual', _run.trigger_type = 'manual'));
      end if;
    end loop;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('pessoas', to_jsonb(coalesce(_people, '{}'::uuid[])), 'mensagem', _txt));

  elsif _t = 'move_stage' then
    select id, pipeline_id into _stage, _pipe from crm_stages where id = nullif(_c->>'stage_id', '')::uuid;
    if _stage is null then
      return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'etapa não existe mais'));
    end if;
    if not _dry then
      update crm_leads set stage_id = _stage, pipeline_id = _pipe where id = _lead and stage_id is distinct from _stage;
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('etapa', _stage, 'simulado', _dry));

  elsif _t = 'add_tag' then
    if nullif(_c->>'tag_id', '') is not null and not _dry then
      insert into crm_lead_tags (lead_id, tag_id) values (_lead, (_c->>'tag_id')::uuid)
      on conflict (lead_id, tag_id) do nothing;
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('tag', _c->>'tag_id', 'simulado', _dry));

  elsif _t = 'remove_tag' then
    if not _dry then
      delete from crm_lead_tags where lead_id = _lead and tag_id = nullif(_c->>'tag_id', '')::uuid;
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('tag', _c->>'tag_id', 'simulado', _dry));

  elsif _t = 'assign_owner' then
    _people := crm_flow_people(_tenant, _owner, _c, _flow.id, _nid, _dry);
    if array_length(_people, 1) is null then
      return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'nenhuma pessoa ativa pra assumir'));
    end if;
    if not _dry then
      update crm_leads set owner_staff_id = _people[1] where id = _lead and owner_staff_id is distinct from _people[1];
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('dono', _people[1], 'simulado', _dry));

  elsif _t = 'set_field' then
    _field := _c->>'field';
    _val := crm_flow_transform(crm_flow_render(coalesce(_c->>'value', ''), _lead, _ctx), _c->>'transform');
    if _field like 'ctx.%' and length(_field) > 4 then
      _ctx := jsonb_set(_ctx, array['vars', substr(_field, 5)], to_jsonb(_val), true);
      update crm_flow_runs set context = _ctx where id = _run.id;
    elsif _dry then
      null;
    elsif _field in ('name', 'email', 'phone', 'company', 'trade_name', 'document', 'city', 'state', 'segment', 'role', 'notes',
                     'main_pain', 'urgency', 'instagram', 'estimated_revenue', 'employee_count',
                     'utm_source', 'utm_medium', 'utm_campaign') then
      if _field = 'name' and btrim(_val) = '' then
        return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'nome não pode ficar vazio'));
      end if;
      execute format('update crm_leads set %I = $1 where id = $2', _field) using nullif(_val, ''), _lead;
    elsif _field = 'opportunity_value' then
      update crm_leads set opportunity_value = crm_flow_num(_val) where id = _lead;
    elsif _field in ('probability', 'fit_score') then
      execute format('update crm_leads set %I = $1 where id = $2', _field) using crm_flow_num(_val)::int, _lead;
    else
      return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'campo não gravável: ' || coalesce(_field, '?')));
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('campo', _field, 'valor', _val, 'simulado', _dry and _field not like 'ctx.%'));

  elsif _t = 'formula' then
    _n := crm_flow_num(crm_flow_render(_c->>'a', _lead, _ctx));
    _m := crm_flow_num(crm_flow_render(_c->>'b', _lead, _ctx));
    _num := case coalesce(_c->>'op', '+') when '+' then _n + _m when '-' then _n - _m when '*' then _n * _m
              when '/' then case when _m = 0 then null else _n / _m end when '%' then _n * _m / 100 else _n end;
    _field := coalesce(nullif(_c->>'result', ''), 'ctx.resultado');
    if _field like 'ctx.%' then
      _ctx := jsonb_set(_ctx, array['vars', substr(_field, 5)], to_jsonb(coalesce(round(_num, 2)::text, '')), true);
      update crm_flow_runs set context = _ctx where id = _run.id;
    elsif _field = 'opportunity_value' and not _dry then
      update crm_leads set opportunity_value = round(_num, 2) where id = _lead;
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('a', _n, 'b', _m, 'resultado', round(_num, 2)));

  elsif _t = 'webhook' then
    if coalesce(_c->>'url', '') !~* '^https?://' then
      return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'URL inválida'));
    end if;
    -- corpo: mapeamento campo -> valor, JSON próprio, ou o lead completo (montado pela edge)
    _body := null; _fields := null;
    if coalesce(_c->>'body_mode', 'lead') = 'fields' then
      select coalesce(jsonb_object_agg(x->>'key', crm_flow_render(x->>'value', _lead, _ctx)), '{}'::jsonb) into _fields
        from jsonb_array_elements(coalesce(_c->'fields', '[]'::jsonb)) x where nullif(x->>'key', '') is not null;
    elsif coalesce(_c->>'body_mode', 'lead') = 'raw' and nullif(_c->>'body', '') is not null then
      _body := crm_flow_render(_c->>'body', _lead, _ctx, true);
    end if;
    if _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('simulado', true, 'url', _c->>'url',
                                'metodo', coalesce(nullif(_c->>'method', ''), 'POST'), 'corpo', coalesce(_fields, to_jsonb(_body))));
    end if;
    insert into crm_flow_outbox (tenant_id, kind, lead_id, flow_id, run_id, node_id, payload)
    values (_tenant, 'webhook', _lead, _flow.id, _run.id, _nid, jsonb_build_object(
      'url', _c->>'url', 'method', coalesce(nullif(_c->>'method', ''), 'POST'), 'headers', coalesce(_c->'headers', '[]'::jsonb),
      'body', _body, 'fields', _fields, 'trigger', _run.trigger_type, 'flow_name', _flow.name, 'vars', coalesce(_ctx->'vars', '{}'::jsonb),
      'wait_response', coalesce((_c->>'wait_response')::boolean, false), 'manual', _run.trigger_type = 'manual'));
    if coalesce((_c->>'wait_response')::boolean, false) then
      return jsonb_build_object('next', 'default', 'wait', jsonb_build_object('kind', 'webhook', 'resume_at', now() + interval '1 hour'),
                                'detail', jsonb_build_object('resultado', 'aguardando resposta do webhook'));
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('resultado', 'webhook na fila'));

  elsif _t = 'enroll_cadence' then
    if _dry then
      return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('simulado', true, 'cadencia', _c->>'cadence_id'));
    end if;
    _ok := crm_flow_cadence_enroll(nullif(_c->>'cadence_id', '')::uuid, _lead);
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('cadencia', _c->>'cadence_id',
                              'resultado', case when _ok then 'inscrito' else 'já estava na cadência ou ela está desligada' end));

  elsif _t = 'stop_cadence' then
    if not _dry then
      update crm_cadence_enrollments set status = 'stopped', stopped_reason = 'flow', next_run_at = null, updated_at = now()
       where lead_id = _lead and status in ('active', 'paused')
         and (nullif(_c->>'cadence_id', '') is null or cadence_id = (_c->>'cadence_id')::uuid);
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('resultado', 'cadências paradas', 'simulado', _dry));

  elsif _t = 'start_flow' then
    if nullif(_c->>'flow_id', '') is not null and (_c->>'flow_id')::uuid <> _flow.id then
      perform crm_flow_start((_c->>'flow_id')::uuid, _lead, 'flow:' || (_c->>'flow_id') || ':from:' || _run.id, 'manual',
                             jsonb_build_object('vars', coalesce(_ctx->'vars', '{}'::jsonb), 'from_run', _run.id), _run.depth + 1, _dry, _run.started_by);
    end if;
    return jsonb_build_object('next', 'default', 'detail', jsonb_build_object('fluxo', _c->>'flow_id'));

  else
    return jsonb_build_object('next', 'default', 'error', true, 'detail', jsonb_build_object('erro', 'bloco desconhecido: ' || coalesce(_t, '?')));
  end if;
end $$;

-- ---------------------------------------------------------------- avançar um run
create or replace function public.crm_flow_advance_inner(_run_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare _run public.crm_flow_runs; _flow public.crm_flows; _node jsonb; _res jsonb; _next text; _guard int := 0; _wait jsonb;
begin
  select * into _run from crm_flow_runs where id = _run_id for update;
  if not found or _run.status not in ('running', 'waiting') then return; end if;
  select * into _flow from crm_flows where id = _run.flow_id;
  if not found then
    update crm_flow_runs set status = 'failed', error = 'fluxo apagado', finished_at = now(), updated_at = now() where id = _run_id;
    return;
  end if;

  update crm_flow_runs set status = 'running', wait_kind = null, resume_at = null, updated_at = now() where id = _run_id;

  while _guard < 60 loop
    _guard := _guard + 1;
    if _run.current_node_id is null then
      update crm_flow_runs set status = 'done', finished_at = now(), updated_at = now() where id = _run_id;
      return;
    end if;
    _node := crm_flow_node(_flow, _run.current_node_id);
    if _node is null then
      update crm_flow_runs set status = 'failed', error = 'bloco não existe mais: ' || _run.current_node_id, finished_at = now(), updated_at = now() where id = _run_id;
      return;
    end if;

    begin
      _res := crm_flow_exec_node(_run, _flow, _node);
    exception when others then
      insert into crm_flow_run_steps (run_id, node_id, node_type, status, detail)
      values (_run_id, _node->>'id', _node->>'type', 'error', jsonb_build_object('erro', sqlerrm));
      update crm_flow_runs set status = 'failed', error = left(sqlerrm, 300), finished_at = now(), steps = steps + 1, updated_at = now() where id = _run_id;
      return;
    end;
    select * into _run from crm_flow_runs where id = _run_id;   -- o contexto pode ter mudado
    _wait := _res->'wait';
    insert into crm_flow_run_steps (run_id, node_id, node_type, status, detail)
    values (_run_id, _node->>'id', _node->>'type',
            case when _wait is not null then 'wait' when coalesce((_res->>'error')::boolean, false) then 'error' else 'ok' end, _res->'detail');

    if _node->>'type' = 'end' then
      update crm_flow_runs set status = 'done', finished_at = now(), steps = steps + 1, updated_at = now() where id = _run_id;
      return;
    end if;

    _next := crm_flow_next(_flow, _run.current_node_id, coalesce(_res->>'next', 'default'));
    if _wait is not null then
      -- fica esperando; ao voltar, o tick decide por qual saída segue
      update crm_flow_runs set status = 'waiting', wait_kind = _wait->>'kind', wait_since = now(),
             resume_at = (_wait->>'resume_at')::timestamptz, steps = steps + 1, updated_at = now(),
             context = context || jsonb_build_object('_wait_node', _run.current_node_id)
       where id = _run_id;
      return;
    end if;
    update crm_flow_runs set current_node_id = _next, steps = steps + 1, updated_at = now() where id = _run_id;
    _run.current_node_id := _next;
  end loop;
  update crm_flow_runs set status = 'failed', error = 'mais de 60 passos seguidos (laço no desenho do fluxo?)', finished_at = now(), updated_at = now() where id = _run_id;
end $$;

-- Marca a profundidade enquanto o run anda, pra que o que ele mexer (etapa, etiqueta, dono)
-- gere evento sabendo de que nível veio. Do 3º nível em diante o evento é ignorado.
create or replace function public.crm_flow_advance(_run_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare _prev text := coalesce(current_setting('crm.flow_depth', true), ''); _d int;
begin
  select depth into _d from crm_flow_runs where id = _run_id;
  perform set_config('crm.flow_depth', coalesce(_d, 1)::text, true);
  perform crm_flow_advance_inner(_run_id);
  perform set_config('crm.flow_depth', _prev, true);
exception when others then
  perform set_config('crm.flow_depth', _prev, true);
  raise;
end $$;

-- ---------------------------------------------------------------- iniciar
create or replace function public.crm_flow_start(
  _flow_id uuid, _lead uuid, _dedupe text, _trigger text, _ctx jsonb default '{}'::jsonb,
  _depth int default 1, _dry boolean default false, _by uuid default null)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare _flow public.crm_flows; _run uuid; _start text;
begin
  if coalesce(_depth, 1) > 3 then return null; end if;
  select * into _flow from crm_flows where id = _flow_id;
  if not found then return null; end if;
  if not exists (select 1 from crm_leads l where l.id = _lead and l.tenant_id is not distinct from _flow.tenant_id) then return null; end if;
  select n->>'id' into _start from jsonb_array_elements(_flow.nodes) n where n->>'type' = 'trigger' limit 1;
  if _start is null then return null; end if;
  -- o mesmo lead não roda o mesmo fluxo duas vezes ao mesmo tempo (simulação não conta)
  if not _dry and exists (select 1 from crm_flow_runs where flow_id = _flow_id and lead_id = _lead
                             and status in ('running', 'waiting') and not is_dry) then
    return null;
  end if;
  insert into crm_flow_runs (tenant_id, flow_id, lead_id, status, current_node_id, context, trigger_type, dedupe_key, depth, is_dry, started_by)
  values (_flow.tenant_id, _flow_id, _lead, 'running', _start,
          coalesce(_ctx, '{}'::jsonb) || jsonb_build_object('vars', coalesce(_ctx->'vars', '{}'::jsonb)),
          _trigger, case when _dry then null else _dedupe end, coalesce(_depth, 1), coalesce(_dry, false), _by)
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into _run;
  if _run is null then return null; end if;
  perform crm_flow_advance(_run);
  return _run;
end $$;

-- Disparo pelo app: teste com um lead, simulação, ou "rodar agora" numa seleção
create or replace function public.crm_flow_start_manual(p_flow_id uuid, p_lead_ids uuid[], p_dry boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare _l uuid; _n int := 0; _skip int := 0; _me uuid := public.get_current_staff_id(); _ok boolean; _runs uuid[] := '{}'; _r uuid;
begin
  if _me is null then raise exception 'Sem permissão'; end if;
  if not coalesce(p_dry, false) and not public.crm_flow_can_edit() then
    raise exception 'Só master, admin ou head comercial rodam um fluxo de verdade';
  end if;
  select true into _ok from crm_flows where id = p_flow_id and public.tenant_matches(tenant_id);
  if not coalesce(_ok, false) then raise exception 'Fluxo não encontrado'; end if;
  if coalesce(array_length(p_lead_ids, 1), 0) = 0 then raise exception 'Nenhum lead selecionado'; end if;
  if array_length(p_lead_ids, 1) > 200 then raise exception 'No máximo 200 leads por vez'; end if;
  foreach _l in array p_lead_ids loop
    -- quem não edita fluxo só simula em lead que é dele
    if not public.crm_flow_can_edit() and not exists (select 1 from crm_leads where id = _l and owner_staff_id = _me) then
      _skip := _skip + 1; continue;
    end if;
    _r := crm_flow_start(p_flow_id, _l, null, 'manual', jsonb_build_object('manual', true), 1, coalesce(p_dry, false), _me);
    if _r is not null then _n := _n + 1; _runs := _runs || _r; else _skip := _skip + 1; end if;
  end loop;
  return jsonb_build_object('started', _n, 'skipped', _skip, 'run_ids', to_jsonb(_runs));
end $$;

create or replace function public.crm_flow_run_cancel(p_run_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.crm_flow_can_edit() then raise exception 'Sem permissão'; end if;
  update crm_flow_runs set status = 'cancelled', finished_at = now(), updated_at = now()
   where id = p_run_id and status in ('running', 'waiting') and public.tenant_matches(tenant_id);
  if found then
    update crm_flow_outbox set status = 'cancelled', error = 'execução cancelada', updated_at = now()
     where run_id = p_run_id and status = 'pending';
    insert into crm_flow_run_steps (run_id, node_id, node_type, status, detail)
    values (p_run_id, null, 'cancel', 'skip', jsonb_build_object('resultado', 'cancelado por ' || coalesce((select name from onboarding_staff where id = public.get_current_staff_id()), 'usuário')));
  end if;
end $$;

-- Retorno do webhook (chamado pela edge): guarda a resposta, aplica o mapeamento e segue
create or replace function public.crm_flow_webhook_result(_run_id uuid, _ok boolean, _http int, _body jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare _run public.crm_flow_runs; _flow public.crm_flows; _node jsonb; _m jsonb; _v text; _ctx jsonb; _to text;
begin
  select * into _run from crm_flow_runs where id = _run_id for update;
  if not found or _run.status <> 'waiting' or _run.wait_kind <> 'webhook' then return; end if;
  select * into _flow from crm_flows where id = _run.flow_id;
  if not found then return; end if;
  _node := crm_flow_node(_flow, _run.context->>'_wait_node');
  _ctx := jsonb_set(_run.context, '{vars,webhook_status}', to_jsonb(coalesce(_http, 0)::text), true);
  for _m in select * from jsonb_array_elements(coalesce(_node->'data'->'map', '[]'::jsonb)) loop
    continue when nullif(_m->>'from', '') is null or nullif(_m->>'to', '') is null;
    _v := _body #>> string_to_array(_m->>'from', '.');
    _to := _m->>'to';
    if _to like 'ctx.%' then
      _ctx := jsonb_set(_ctx, array['vars', substr(_to, 5)], to_jsonb(coalesce(_v, '')), true);
    elsif _v is not null and _to in ('name', 'email', 'phone', 'company', 'city', 'state', 'segment', 'role', 'notes', 'main_pain',
                                     'urgency', 'instagram', 'estimated_revenue', 'employee_count') then
      execute format('update crm_leads set %I = $1 where id = $2', _to) using _v, _run.lead_id;
    elsif _v is not null and _to = 'opportunity_value' then
      update crm_leads set opportunity_value = crm_flow_num(_v) where id = _run.lead_id;
    end if;
  end loop;
  update crm_flow_runs set context = _ctx, current_node_id = crm_flow_next(_flow, _run.context->>'_wait_node', 'default') where id = _run_id;
  insert into crm_flow_run_steps (run_id, node_id, node_type, status, detail)
  values (_run_id, _run.context->>'_wait_node', 'webhook', case when _ok then 'ok' else 'error' end,
          jsonb_build_object('http', _http, 'resposta', left(coalesce(_body::text, ''), 2000)));
  perform crm_flow_advance(_run_id);
end $$;

-- ---------------------------------------------------------------- eventos
-- Devolve quantos fluxos o evento iniciou; -1 = ignorado por laço.
create or replace function public.crm_flow_handle_event(ev public.crm_flow_events)
returns int language plpgsql volatile security definer set search_path = public as $$
declare
  f public.crm_flows; _cfg jsonb; _n int := 0; _key text;
  _bulk boolean := coalesce((ev.payload->>'bulk')::boolean, false);
  _depth int := coalesce((ev.payload->>'depth')::int, 0);
  _tenant uuid; _stage uuid; _pipe uuid; _found boolean;
begin
  select tenant_id, stage_id, pipeline_id, true into _tenant, _stage, _pipe, _found from crm_leads where id = ev.lead_id;
  if not coalesce(_found, false) then return 0; end if;
  if _depth >= 3 then return -1; end if;
  for f in select * from crm_flows where is_active and trigger_type = ev.trigger_type and tenant_id is not distinct from _tenant loop
    _cfg := coalesce(f.trigger_config, '{}'::jsonb);
    continue when _bulk and not coalesce((_cfg->>'include_bulk')::boolean, false);
    if ev.trigger_type = 'stage_changed' then
      continue when nullif(_cfg->>'stage_id', '') is not null and (ev.payload->>'stage_id') is distinct from (_cfg->>'stage_id');
      continue when nullif(_cfg->>'from_stage_id', '') is not null and (ev.payload->>'from_stage_id') is distinct from (_cfg->>'from_stage_id');
      -- o lead já saiu da etapa do evento antes de o motor rodar: não dispara atrasado
      continue when (ev.payload->>'stage_id') is distinct from _stage::text;
    elsif ev.trigger_type = 'tag_added' then
      continue when nullif(_cfg->>'tag_id', '') is not null and (ev.payload->>'tag_id') is distinct from (_cfg->>'tag_id');
    end if;
    continue when not crm_flow_filters_match(f.filters, ev.lead_id);
    _key := case when ev.trigger_type = 'meeting_scheduled'
                 then 'ms:' || f.id || ':' || ev.lead_id || ':' || to_char(ev.created_at, 'YYYYMMDDHH24')
                 else 'ev:' || f.id || ':' || ev.id end;
    if crm_flow_start(f.id, ev.lead_id, _key, ev.trigger_type,
                      jsonb_build_object('event', ev.payload, 'vars', coalesce(ev.payload->'vars', '{}'::jsonb)), _depth + 1) is not null then
      _n := _n + 1;
    end if;
  end loop;
  return _n;
end $$;

-- ---------------------------------------------------------------- gatilhos por tempo
create or replace function public.crm_flow_scan_time()
returns int language plpgsql volatile security definer set search_path = public as $$
declare
  f public.crm_flows; x record; _n int := 0; _k int; _cfg jsonb; _only_new boolean; _since timestamptz;
  _days int; _hours int; _mins int; _lento boolean;
  _w0 timestamptz; _w1 timestamptz; _cur_ts timestamptz; _cur_id uuid; _touch timestamptz; _seen int; _cheio boolean;
begin
  for f in select * from crm_flows where is_active and trigger_type in ('lead_idle', 'activity_overdue', 'no_reply', 'lead_no_reply') loop
    -- gatilhos medidos em dias varrem a cada 5 min; os de minutos/horas, todo ciclo
    _lento := f.trigger_type in ('lead_idle', 'lead_no_reply');
    continue when _lento and f.last_scan_at is not null and f.last_scan_at > now() - interval '5 minutes';
    _cfg := coalesce(f.trigger_config, '{}'::jsonb);
    _only_new := coalesce((_cfg->>'only_new')::boolean, true);
    _since := coalesce(f.activated_at, f.created_at);
    _k := 0;
    begin
      if f.trigger_type = 'lead_idle' then
        -- parado = N dias sem movimento (entrada na etapa, atividade concluída ou mensagem).
        -- Dispara uma vez por "parada": se alguém mexer e o lead parar de novo, conta outra vez.
        -- A busca parte de quem cruzou a marca dos N dias nos últimos 3 dias (três índices pequenos),
        -- nunca dos 118 mil leads.
        _days := greatest(coalesce(nullif(_cfg->>'days', '')::int, 3), 1);
        _w1 := now() - make_interval(days => _days);
        _w0 := greatest(_since - make_interval(days => _days), _w1 - interval '3 days');
        for x in
          with cand as (
            select l.id from crm_leads l where l.stage_entered_at >= _w0 and l.stage_entered_at <= _w1
            union
            select a.lead_id from crm_activities a where a.completed_at >= _w0 and a.completed_at <= _w1
            union
            select c.lead_id from crm_whatsapp_conversations c
             where c.lead_id is not null and c.last_message_at >= _w0 and c.last_message_at <= _w1
          )
          select l.id, t.touch
            from cand
            join crm_leads l on l.id = cand.id
            join crm_stages s on s.id = l.stage_id and not coalesce(s.is_final, false)
            cross join lateral (select crm_flow_lead_touch(l.id) as touch) t
           where l.tenant_id is not distinct from f.tenant_id
             and (nullif(_cfg->>'stage_id', '') is null or l.stage_id = (_cfg->>'stage_id')::uuid)
             and t.touch >= _w0 and t.touch <= _w1
             and not exists (select 1 from crm_flow_runs r
                              where r.dedupe_key = 'idle:' || f.id || ':' || l.id || ':' || extract(epoch from t.touch)::bigint)
           order by t.touch desc
           limit 200
        loop
          continue when not crm_flow_filters_match(f.filters, x.id);
          if crm_flow_start(f.id, x.id, 'idle:' || f.id || ':' || x.id || ':' || extract(epoch from x.touch)::bigint, 'lead_idle',
               jsonb_build_object('vars', jsonb_build_object('parado_desde', to_char(x.touch at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), 'dias_parado', _days::text))) is not null then
            _k := _k + 1;
          end if;
          exit when _k >= 50;
        end loop;

        -- "Pegar também quem já estava parado": drena o passado aos poucos, do mais recente pro
        -- mais antigo, com um cursor guardado no fluxo (50 disparos por varredura, no máximo).
        if not _only_new and _k < 50 and not coalesce((f.scan_state->>'backlog_done')::boolean, false) then
          _cur_ts := coalesce((f.scan_state->>'cursor_ts')::timestamptz, _since - make_interval(days => _days));
          _cur_id := coalesce((f.scan_state->>'cursor_id')::uuid, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);
          _seen := 0; _cheio := false;
          -- a subconsulta só anda no índice de stage_entered_at (3.000 por vez); os filtros vêm depois,
          -- pra que o cursor avance mesmo quando o lote inteiro é de outro funil
          for x in
            select l.id, l.stage_entered_at,
                   (s.id is not null and not coalesce(s.is_final, false)
                    and l.tenant_id is not distinct from f.tenant_id
                    and (nullif(_cfg->>'stage_id', '') is null or l.stage_id = (_cfg->>'stage_id')::uuid)
                    and (nullif(f.filters->>'pipeline_id', '') is null or l.pipeline_id = (f.filters->>'pipeline_id')::uuid)
                    and (nullif(f.filters->>'stage_id', '') is null or l.stage_id = (f.filters->>'stage_id')::uuid)) as serve
              from (select l0.id, l0.stage_entered_at, l0.stage_id, l0.pipeline_id, l0.tenant_id
                      from crm_leads l0
                     where l0.stage_entered_at <= _cur_ts and (l0.stage_entered_at < _cur_ts or l0.id < _cur_id)
                     order by l0.stage_entered_at desc, l0.id desc
                     limit 3000) l
              left join crm_stages s on s.id = l.stage_id
             order by l.stage_entered_at desc, l.id desc
          loop
            _seen := _seen + 1; _cur_ts := x.stage_entered_at; _cur_id := x.id;
            continue when not x.serve;
            _touch := crm_flow_lead_touch(x.id);
            continue when _touch is null or _touch > _w1;
            continue when not crm_flow_filters_match(f.filters, x.id);
            if crm_flow_start(f.id, x.id, 'idle:' || f.id || ':' || x.id || ':' || extract(epoch from _touch)::bigint, 'lead_idle',
                 jsonb_build_object('vars', jsonb_build_object('parado_desde', to_char(_touch at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), 'dias_parado', _days::text))) is not null then
              _k := _k + 1;
            end if;
            if _k >= 50 then _cheio := true; exit; end if;
          end loop;
          update crm_flows set scan_state = jsonb_build_object('cursor_ts', _cur_ts, 'cursor_id', _cur_id,
                 'backlog_done', (not _cheio and _seen < 3000)) where id = f.id;
        end if;

      elsif f.trigger_type = 'activity_overdue' then
        _hours := greatest(coalesce(nullif(_cfg->>'hours', '')::int, 1), 0);
        for x in
          select a.id, a.lead_id, a.title, a.scheduled_at, a.responsible_staff_id
            from crm_activities a
            join crm_leads l on l.id = a.lead_id and l.tenant_id is not distinct from f.tenant_id
           where a.status = 'pending'
             and a.scheduled_at < now() - make_interval(hours => _hours)
             and a.scheduled_at > now() - interval '7 days'
             and (nullif(_cfg->>'activity_type', '') is null or a.type = _cfg->>'activity_type')
             and (not _only_new or a.scheduled_at + make_interval(hours => _hours) >= _since)
             and coalesce(a.automation_config->>'flow_id', '') <> f.id::text   -- tarefa que o próprio fluxo criou não realimenta
             and not exists (select 1 from crm_flow_runs r where r.dedupe_key = 'overdue:' || f.id || ':' || a.id)
           order by a.scheduled_at
           limit 100
        loop
          continue when not crm_flow_filters_match(f.filters, x.lead_id);
          if crm_flow_start(f.id, x.lead_id, 'overdue:' || f.id || ':' || x.id, 'activity_overdue',
               jsonb_build_object('activity_id', x.id, 'vars', jsonb_build_object('tarefa', coalesce(x.title, ''),
                 'tarefa_data', to_char(x.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
                 'tarefa_responsavel', coalesce((select name from onboarding_staff where id = x.responsible_staff_id), '')))) is not null then
            _k := _k + 1;
          end if;
          exit when _k >= 50;
        end loop;

      elsif f.trigger_type = 'no_reply' then
        -- SLA: o cliente escreveu e ninguém respondeu em N minutos (úteis, se pedido)
        _mins := greatest(coalesce(nullif(_cfg->>'minutes', '')::int, 15), 1);
        for x in
          select c.id, c.lead_id, c.last_inbound_at
            from crm_whatsapp_conversations c
            join crm_leads l on l.id = c.lead_id and l.tenant_id is not distinct from f.tenant_id
            left join crm_whatsapp_contacts ct on ct.id = c.contact_id
           where c.last_message_direction = 'inbound'
             and c.project_id is null and c.merged_into is null
             and coalesce(c.status, 'open') <> 'closed'
             and c.last_inbound_at < now() - make_interval(mins => _mins)
             and c.last_inbound_at > now() - interval '3 days'
             and (nullif(_cfg->>'instance_id', '') is null or c.instance_id = (_cfg->>'instance_id')::uuid
                  or c.official_instance_id = (_cfg->>'instance_id')::uuid)
             and (not _only_new or c.last_inbound_at >= _since)
             and coalesce(ct.phone, '') !~ '[@-]'   -- grupo não entra
             and (not coalesce((_cfg->>'business_hours')::boolean, false)
                  or crm_business_seconds_between(c.last_inbound_at, now()) >= _mins * 60)
             and not exists (select 1 from crm_flow_runs r
                              where r.dedupe_key = 'sla:' || f.id || ':' || c.id || ':' || extract(epoch from c.last_inbound_at)::bigint)
           order by c.last_inbound_at
           limit 100
        loop
          continue when not crm_flow_filters_match(f.filters, x.lead_id);
          if crm_flow_start(f.id, x.lead_id, 'sla:' || f.id || ':' || x.id || ':' || extract(epoch from x.last_inbound_at)::bigint, 'no_reply',
               jsonb_build_object('conversation_id', x.id, 'vars', jsonb_build_object(
                 'esperando_desde', to_char(x.last_inbound_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'minutos_sla', _mins::text))) is not null then
            _k := _k + 1;
          end if;
          exit when _k >= 50;
        end loop;

      elsif f.trigger_type = 'lead_no_reply' then
        -- a última mensagem foi nossa e o lead está há N dias sem responder
        _days := greatest(coalesce(nullif(_cfg->>'days', '')::int, 2), 1);
        for x in
          select c.id, c.lead_id, c.last_message_at
            from crm_whatsapp_conversations c
            join crm_leads l on l.id = c.lead_id and l.tenant_id is not distinct from f.tenant_id
            join crm_stages s on s.id = l.stage_id and not coalesce(s.is_final, false)
            left join crm_whatsapp_contacts ct on ct.id = c.contact_id
           where c.last_message_direction = 'outbound'
             and c.project_id is null and c.merged_into is null
             and c.last_message_at < now() - make_interval(days => _days)
             and c.last_message_at > now() - make_interval(days => _days + 7)
             and (not _only_new or c.last_message_at + make_interval(days => _days) >= _since)
             and coalesce(ct.phone, '') !~ '[@-]'
             and not exists (select 1 from crm_flow_runs r
                              where r.dedupe_key = 'lnr:' || f.id || ':' || c.id || ':' || extract(epoch from c.last_message_at)::bigint)
           order by c.last_message_at
           limit 100
        loop
          continue when not crm_flow_filters_match(f.filters, x.lead_id);
          if crm_flow_start(f.id, x.lead_id, 'lnr:' || f.id || ':' || x.id || ':' || extract(epoch from x.last_message_at)::bigint, 'lead_no_reply',
               jsonb_build_object('conversation_id', x.id, 'vars', jsonb_build_object(
                 'ultima_mensagem', to_char(x.last_message_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'dias_sem_resposta', _days::text))) is not null then
            _k := _k + 1;
          end if;
          exit when _k >= 50;
        end loop;
      end if;
    exception when others then
      raise warning 'crm_flow_scan_time fluxo %: %', f.id, sqlerrm;
    end;
    if _lento then update crm_flows set last_scan_at = now() where id = f.id; end if;
    _n := _n + _k;
  end loop;
  return _n;
end $$;

-- ---------------------------------------------------------------- o relógio
create or replace function public.crm_flow_tick()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  ev public.crm_flow_events; r record; _flow public.crm_flows; _next text; _replied timestamptz;
  _ev int := 0; _err int := 0; _ign int := 0; _ret int := 0; _tempo int := 0; _res int; _disp boolean := false;
  _tem_ativo boolean; _secret text;
begin
  if not pg_try_advisory_xact_lock(hashtext('crm_flow_tick')) then return jsonb_build_object('skip', 'ciclo anterior em andamento'); end if;
  perform set_config('crm.flow_depth', '0', true);

  -- 1) eventos
  if exists (select 1 from crm_flow_events where status = 'pending') then
    update crm_flow_events set status = 'expired', processed_at = now(), error = 'pendente há mais de 24h'
     where status = 'pending' and created_at < now() - interval '24 hours';
    -- rajada: mais de 30 eventos do mesmo tipo esperando = ação em massa, não vira disparo
    update crm_flow_events e set payload = e.payload || '{"bulk": true, "rajada": true}'::jsonb
     where e.status = 'pending' and not coalesce((e.payload->>'bulk')::boolean, false)
       and e.trigger_type in (select trigger_type from crm_flow_events where status = 'pending' group by trigger_type having count(*) > 30);
    for ev in select * from crm_flow_events where status = 'pending' order by created_at limit 400 for update skip locked loop
      begin
        _res := crm_flow_handle_event(ev);
        if _res < 0 then
          update crm_flow_events set status = 'ignored', processed_at = now(), error = 'laço de automações (3 níveis)' where id = ev.id;
          _ign := _ign + 1;
        else
          update crm_flow_events set status = 'done', processed_at = now(), payload = payload || jsonb_build_object('started', _res) where id = ev.id;
          _ev := _ev + 1;
        end if;
      exception when others then
        update crm_flow_events set status = 'error', processed_at = now(), error = left(sqlerrm, 500) where id = ev.id;
        _err := _err + 1;
      end;
    end loop;
    perform set_config('crm.flow_depth', '0', true);
  end if;

  -- 2) esperas (fluxo desligado fica pausado; execução manual segue)
  if exists (select 1 from crm_flow_runs where status = 'waiting') then
    for r in
      select ru.* from crm_flow_runs ru join crm_flows fl on fl.id = ru.flow_id
       where ru.status = 'waiting' and ru.resume_at <= now() and (fl.is_active or ru.trigger_type = 'manual')
       order by ru.resume_at limit 200
    loop
      begin
        select * into _flow from crm_flows where id = r.flow_id;
        if r.wait_kind = 'reply' then
          _next := crm_flow_next(_flow, r.context->>'_wait_node', 'timeout');
          insert into crm_flow_run_steps (run_id, node_id, node_type, status, detail)
          values (r.id, r.context->>'_wait_node', 'wait_reply', 'ok', '{"resultado": "estourou o prazo"}'::jsonb);
        elsif r.wait_kind = 'webhook' then
          _next := crm_flow_next(_flow, r.context->>'_wait_node', 'default');
          insert into crm_flow_run_steps (run_id, node_id, node_type, status, detail)
          values (r.id, r.context->>'_wait_node', 'webhook', 'error', '{"erro": "sem resposta em 1 hora"}'::jsonb);
        else
          _next := crm_flow_next(_flow, r.context->>'_wait_node', 'default');
        end if;
        update crm_flow_runs set current_node_id = _next where id = r.id;
        perform crm_flow_advance(r.id);
        _ret := _ret + 1;
      exception when others then
        update crm_flow_runs set status = 'failed', error = left(sqlerrm, 300), finished_at = now(), updated_at = now() where id = r.id;
      end;
    end loop;

    -- espera por resposta: o lead respondeu?
    for r in
      select ru.* from crm_flow_runs ru join crm_flows fl on fl.id = ru.flow_id
       where ru.status = 'waiting' and ru.wait_kind = 'reply' and (fl.is_active or ru.trigger_type = 'manual')
       order by ru.wait_since limit 300
    loop
      begin
        _replied := crm_flow_last_inbound(r.lead_id, r.wait_since);
        if _replied is not null then
          select * into _flow from crm_flows where id = r.flow_id;
          insert into crm_flow_run_steps (run_id, node_id, node_type, status, detail)
          values (r.id, r.context->>'_wait_node', 'wait_reply', 'ok', jsonb_build_object('resultado', 'respondeu', 'em', _replied));
          update crm_flow_runs set current_node_id = crm_flow_next(_flow, r.context->>'_wait_node', 'replied') where id = r.id;
          perform crm_flow_advance(r.id);
          _ret := _ret + 1;
        end if;
      exception when others then
        update crm_flow_runs set status = 'failed', error = left(sqlerrm, 300), finished_at = now(), updated_at = now() where id = r.id;
      end;
    end loop;
    perform set_config('crm.flow_depth', '0', true);
  end if;

  -- 3) gatilhos por tempo
  select exists (select 1 from crm_flows where is_active and trigger_type in ('lead_idle', 'activity_overdue', 'no_reply', 'lead_no_reply')) into _tem_ativo;
  if _tem_ativo then
    _tempo := crm_flow_scan_time();
    perform set_config('crm.flow_depth', '0', true);
  end if;

  -- 4) fila de saída: destrava, expira e chama a edge só se houver o que enviar
  if exists (select 1 from crm_flow_outbox where status in ('pending', 'sending')) then
    update crm_flow_outbox set status = 'pending', updated_at = now()
     where status = 'sending' and updated_at < now() - interval '10 minutes' and attempts < 3 and kind = 'webhook';
    -- WhatsApp preso em "sending" não reenvia sozinho: pode ter saído, e mandar em dobro é pior
    update crm_flow_outbox set status = 'failed', error = 'envio interrompido; confira na conversa se saiu', updated_at = now()
     where status = 'sending' and updated_at < now() - interval '10 minutes' and (attempts >= 3 or kind <> 'webhook');
    update crm_flow_outbox set status = 'cancelled', error = 'expirou: mais de 24 h de atraso', updated_at = now()
     where status = 'pending' and scheduled_at < now() - interval '24 hours';
    if exists (select 1 from crm_flow_outbox o left join crm_flows fl on fl.id = o.flow_id
                where o.status = 'pending' and o.scheduled_at <= now()
                  and (fl.is_active or coalesce((o.payload->>'manual')::boolean, false))) then
      select value into _secret from app_secrets where key = 'flow_secret';
      if _secret is not null then
        perform net.http_post(
          url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/crm-flow-dispatch',
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-flow-secret', _secret),
          body := '{}'::jsonb,
          timeout_milliseconds := 55000);
        _disp := true;
      end if;
    end if;
  end if;

  -- 5) faxina (uma vez por hora): eventos processados com mais de 14 dias
  if extract(minute from now())::int = 7 then
    delete from crm_flow_events where status <> 'pending' and created_at < now() - interval '14 days';
  end if;

  return jsonb_build_object('eventos', _ev, 'ignorados', _ign, 'erros', _err, 'retomados', _ret, 'tempo', _tempo, 'dispatch', _disp);
end $$;

-- ---------------------------------------------------------------- fila de saída (edge crm-flow-dispatch)
create or replace function public.crm_flow_outbox_claim(_limit int default 20)
returns setof public.crm_flow_outbox language sql volatile security definer set search_path = public as $$
  update crm_flow_outbox o
     set status = 'sending', attempts = o.attempts + 1, updated_at = now()
   where o.id in (
     select x.id from crm_flow_outbox x left join crm_flows fl on fl.id = x.flow_id
      where x.status = 'pending' and x.scheduled_at <= now()
        and (fl.is_active or coalesce((x.payload->>'manual')::boolean, false))
      order by x.scheduled_at
      limit greatest(1, least(coalesce(_limit, 20), 50))
      for update of x skip locked)
  returning o.*
$$;

-- Resultado de um item: fecha o item e escreve o desfecho na linha do tempo do run
create or replace function public.crm_flow_outbox_result(_id uuid, _status text, _error text default null, _detail jsonb default '{}'::jsonb, _retry_minutes int default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare o public.crm_flow_outbox;
begin
  select * into o from crm_flow_outbox where id = _id for update;
  if not found then return; end if;
  if _status = 'retry' and o.attempts < 3 then
    update crm_flow_outbox set status = 'pending', error = left(_error, 500),
           scheduled_at = now() + make_interval(mins => coalesce(_retry_minutes, 5 * o.attempts)), updated_at = now()
     where id = _id;
    return;
  end if;
  update crm_flow_outbox
     set status = case when _status = 'retry' then 'failed' else _status end,
         error = left(_error, 500), sent_at = case when _status = 'sent' then now() end, updated_at = now()
   where id = _id;
  -- webhook que espera resposta já escreveu o próprio passo (crm_flow_webhook_result)
  if o.run_id is not null and not (o.kind = 'webhook' and coalesce((o.payload->>'wait_response')::boolean, false)) then
    insert into crm_flow_run_steps (run_id, node_id, node_type, status, detail)
    values (o.run_id, o.node_id, case o.kind when 'webhook' then 'webhook' when 'staff_whatsapp' then 'notify' else 'send_whatsapp' end,
            case when _status = 'sent' then 'ok' when _status = 'cancelled' then 'skip' else 'error' end,
            coalesce(_detail, '{}'::jsonb) || jsonb_build_object('envio',
              case when _status = 'sent' then 'enviado' when _status = 'cancelled' then 'cancelado' else 'falhou' end)
            || case when _error is null then '{}'::jsonb else jsonb_build_object('erro', left(_error, 300)) end);
  end if;
end $$;

-- ---------------------------------------------------------------- telas
create or replace function public.crm_flows_painel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if public.get_current_staff_id() is null then raise exception 'Sem permissão'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'name', f.name, 'description', f.description, 'is_active', f.is_active, 'trigger_type', f.trigger_type,
      'nodes_n', jsonb_array_length(f.nodes), 'updated_at', f.updated_at, 'activated_at', f.activated_at, 'created_by', s.name,
      'runs_total', (select count(*) from crm_flow_runs r where r.flow_id = f.id and not r.is_dry),
      'runs_running', (select count(*) from crm_flow_runs r where r.flow_id = f.id and r.status in ('running', 'waiting')),
      'runs_done', (select count(*) from crm_flow_runs r where r.flow_id = f.id and r.status = 'done' and not r.is_dry),
      'runs_failed', (select count(*) from crm_flow_runs r where r.flow_id = f.id and r.status = 'failed' and not r.is_dry),
      'runs_dry', (select count(*) from crm_flow_runs r where r.flow_id = f.id and r.is_dry),
      'outbox_pending', (select count(*) from crm_flow_outbox o where o.flow_id = f.id and o.status = 'pending'),
      'last_run_at', (select max(started_at) from crm_flow_runs r where r.flow_id = f.id)
    ) order by f.updated_at desc), '[]'::jsonb)
    from crm_flows f left join onboarding_staff s on s.id = f.created_by
    where public.tenant_matches(f.tenant_id));
end $$;

-- Contadores de um fluxo, calculados no banco (a lista de execuções é paginada)
create or replace function public.crm_flow_stats(p_flow_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if public.get_current_staff_id() is null then raise exception 'Sem permissão'; end if;
  if not exists (select 1 from crm_flows where id = p_flow_id and public.tenant_matches(tenant_id)) then raise exception 'Fluxo não encontrado'; end if;
  return jsonb_build_object(
    'status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                 from (select status, count(*) n from crm_flow_runs where flow_id = p_flow_id group by status) t),
    'total', (select count(*) from crm_flow_runs where flow_id = p_flow_id),
    'simulacoes', (select count(*) from crm_flow_runs where flow_id = p_flow_id and is_dry),
    'nodes', (select coalesce(jsonb_object_agg(node_id, jsonb_build_object('n', n, 'erros', erros)), '{}'::jsonb)
                from (select s.node_id, count(distinct s.run_id) n, count(*) filter (where s.status = 'error') erros
                        from crm_flow_run_steps s join crm_flow_runs r on r.id = s.run_id
                       where r.flow_id = p_flow_id and s.node_id is not null group by s.node_id) t),
    'esperando', (select coalesce(jsonb_object_agg(current_node_id, n), '{}'::jsonb)
                    from (select current_node_id, count(*) n from crm_flow_runs
                           where flow_id = p_flow_id and status = 'waiting' and current_node_id is not null group by current_node_id) t));
end $$;

-- Execuções com o passo a passo: por fluxo, por lead, por situação, por bloco, por nome do lead
create or replace function public.crm_flow_runs_search(
  p_flow_id uuid default null, p_lead_id uuid default null, p_status text default null, p_node text default null,
  p_search text default null, p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare _total bigint; _rows jsonb; _q text := nullif(btrim(coalesce(p_search, '')), '');
        _me uuid := public.get_current_staff_id(); _tudo boolean := public.crm_flow_can_edit();
begin
  if _me is null then raise exception 'Sem permissão'; end if;
  select count(*) into _total
    from crm_flow_runs r left join crm_leads l on l.id = r.lead_id
   where public.tenant_matches(r.tenant_id)
     and (_tudo or l.owner_staff_id = _me)
     and (p_flow_id is null or r.flow_id = p_flow_id)
     and (p_lead_id is null or r.lead_id = p_lead_id)
     and (nullif(p_status, '') is null or p_status = 'all' or r.status = p_status)
     and (nullif(p_node, '') is null or exists (select 1 from crm_flow_run_steps s where s.run_id = r.id and s.node_id = p_node))
     and (_q is null or l.name ilike '%' || _q || '%' or l.phone ilike '%' || _q || '%' or l.company ilike '%' || _q || '%');
  select coalesce(jsonb_agg(row order by started_at desc), '[]'::jsonb) into _rows from (
    select r.started_at, jsonb_build_object(
      'id', r.id, 'flow_id', r.flow_id, 'flow', f.name, 'lead_id', r.lead_id, 'lead', l.name, 'lead_phone', l.phone,
      'status', r.status, 'current_node_id', r.current_node_id, 'wait_kind', r.wait_kind, 'resume_at', r.resume_at,
      'trigger_type', r.trigger_type, 'steps', r.steps, 'error', r.error, 'is_dry', r.is_dry,
      'started_at', r.started_at, 'finished_at', r.finished_at,
      'started_by', (select name from onboarding_staff where id = r.started_by),
      'passos', (select coalesce(jsonb_agg(jsonb_build_object('node_id', s.node_id, 'type', s.node_type, 'status', s.status,
                                 'detail', s.detail, 'at', s.created_at) order by s.created_at, s.id), '[]'::jsonb)
                   from crm_flow_run_steps s where s.run_id = r.id)) as row
      from crm_flow_runs r
      join crm_flows f on f.id = r.flow_id
      left join crm_leads l on l.id = r.lead_id
     where public.tenant_matches(r.tenant_id)
       and (_tudo or l.owner_staff_id = _me)
       and (p_flow_id is null or r.flow_id = p_flow_id)
       and (p_lead_id is null or r.lead_id = p_lead_id)
       and (nullif(p_status, '') is null or p_status = 'all' or r.status = p_status)
       and (nullif(p_node, '') is null or exists (select 1 from crm_flow_run_steps s where s.run_id = r.id and s.node_id = p_node))
       and (_q is null or l.name ilike '%' || _q || '%' or l.phone ilike '%' || _q || '%' or l.company ilike '%' || _q || '%')
     order by r.started_at desc
     limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(coalesce(p_offset, 0), 0)) t;
  return jsonb_build_object('total', _total, 'rows', _rows);
end $$;

-- Saúde do motor (cabeçalho da tela)
create or replace function public.crm_flow_engine_status()
returns jsonb language plpgsql stable security definer set search_path = public, cron as $$
declare _job record; _last timestamptz; _st text;
begin
  if public.get_current_staff_id() is null then raise exception 'Sem permissão'; end if;
  select jobid, active into _job from cron.job where jobname = 'crm-flow-tick';
  if found then
    -- cron.job_run_details tem centenas de milhares de linhas e só o índice da chave: procurar pelo
    -- runid mais recente (0,2 ms) em vez de ordenar por start_time (3,7 s). Olha só as últimas
    -- 3.000 execuções de qualquer job: se o tick não está ali, o motor está parado mesmo.
    select d.end_time, d.status into _last, _st from cron.job_run_details d
     where d.jobid = _job.jobid and d.runid > (select max(runid) from cron.job_run_details) - 3000
     order by d.runid desc limit 1;
  end if;
  return jsonb_build_object(
    'cron_active', coalesce(_job.active, false), 'last_tick_at', _last, 'last_tick_status', _st,
    'active_flows', (select count(*) from crm_flows where is_active and public.tenant_matches(tenant_id)),
    'pending_events', (select count(*) from crm_flow_events where status = 'pending'),
    'waiting_runs', (select count(*) from crm_flow_runs where status = 'waiting'),
    'pending_outbox', (select count(*) from crm_flow_outbox where status = 'pending'),
    'failed_outbox_24h', (select count(*) from crm_flow_outbox where status = 'failed' and updated_at > now() - interval '24 hours'),
    'dispatch_secret', exists (select 1 from app_secrets where key = 'flow_secret'));
end $$;

-- ---------------------------------------------------------------- quem pode chamar o quê
revoke all on function
  public.crm_flow_exec_node(public.crm_flow_runs, public.crm_flows, jsonb),
  public.crm_flow_advance_inner(uuid), public.crm_flow_advance(uuid),
  public.crm_flow_start(uuid, uuid, text, text, jsonb, int, boolean, uuid),
  public.crm_flow_webhook_result(uuid, boolean, int, jsonb),
  public.crm_flow_handle_event(public.crm_flow_events),
  public.crm_flow_scan_time(), public.crm_flow_tick(),
  public.crm_flow_outbox_claim(int), public.crm_flow_outbox_result(uuid, text, text, jsonb, int),
  public.crm_flow_people(uuid, uuid, jsonb, uuid, text, boolean),
  public.crm_flow_cadence_enroll(uuid, uuid),
  public.crm_flow_render(text, uuid, jsonb, boolean), public.crm_flow_field(uuid, text, jsonb),
  public.crm_flow_rule_ok(uuid, jsonb, jsonb), public.crm_flow_condition_ok(uuid, jsonb, jsonb),
  public.crm_flow_filters_match(jsonb, uuid), public.crm_flow_last_inbound(uuid, timestamptz),
  public.crm_flow_lead_touch(uuid)
from public, anon, authenticated;
grant execute on function
  public.crm_flow_outbox_claim(int), public.crm_flow_outbox_result(uuid, text, text, jsonb, int),
  public.crm_flow_webhook_result(uuid, boolean, int, jsonb), public.crm_flow_tick()
to service_role;
revoke all on function
  public.crm_flow_start_manual(uuid, uuid[], boolean), public.crm_flow_run_cancel(uuid), public.crm_flows_painel(),
  public.crm_flow_stats(uuid), public.crm_flow_runs_search(uuid, uuid, text, text, text, int, int), public.crm_flow_engine_status()
from public, anon;
grant execute on function
  public.crm_flow_start_manual(uuid, uuid[], boolean), public.crm_flow_run_cancel(uuid), public.crm_flows_painel(),
  public.crm_flow_stats(uuid), public.crm_flow_runs_search(uuid, uuid, text, text, text, int, int), public.crm_flow_engine_status(),
  public.crm_flow_window_next(timestamptz)
to authenticated, service_role;

-- ---------------------------------------------------------------- cron
-- Um job só: o tick chama a edge de envio quando há item vencido na fila (segredo em
-- app_secrets, key 'flow_secret', o mesmo valor do secret FLOW_SECRET da edge function).
select cron.schedule('crm-flow-tick', '* * * * *', $cron$ select public.crm_flow_tick() $cron$)
 where not exists (select 1 from cron.job where jobname = 'crm-flow-tick');
