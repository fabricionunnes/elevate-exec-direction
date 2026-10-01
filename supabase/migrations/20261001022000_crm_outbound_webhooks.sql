-- Webhooks de saída do CRM (Configurações > API e Webhooks), 01/10/2026.
-- O CRM avisa sistemas de fora quando algo acontece (lead criado, mudou de etapa,
-- ganho, perdido, trocou de dono, reunião agendada/realizada/no-show).
-- Desenho: gatilho BARATO só enfileira (um insert por webhook inscrito) e a edge
-- function crm-webhook-dispatch entrega (assinatura HMAC, 10 s de timeout, 5 tentativas).
-- Sem webhook ativo o gatilho custa um EXISTS numa tabela minúscula e sai.
-- Só o CRM da UNV (tenant nulo): quem gerencia é master/admin da UNV.

create table if not exists public.crm_outbound_webhooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  secret text not null default ('whsec_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  events text[] not null default array[]::text[],
  pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references public.onboarding_staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_outbound_webhooks_url_check check (url ~* '^https?://')
);
create index if not exists crm_outbound_webhooks_active_idx on public.crm_outbound_webhooks (id) where is_active;

create table if not exists public.crm_outbound_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.crm_outbound_webhooks(id) on delete cascade,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'retrying', 'delivered', 'failed')),
  http_status integer,
  response text,
  attempts integer not null default 0,
  next_retry_at timestamptz default now(),
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  delivered_at timestamptz
);
create index if not exists crm_outbound_webhook_deliveries_queue_idx
  on public.crm_outbound_webhook_deliveries (next_retry_at) where status in ('pending', 'retrying');
create index if not exists crm_outbound_webhook_deliveries_sending_idx
  on public.crm_outbound_webhook_deliveries (last_attempt_at) where status = 'sending';
create index if not exists crm_outbound_webhook_deliveries_webhook_idx
  on public.crm_outbound_webhook_deliveries (webhook_id, created_at desc);
create index if not exists crm_outbound_webhook_deliveries_created_idx
  on public.crm_outbound_webhook_deliveries (created_at desc);

alter table public.crm_outbound_webhooks enable row level security;
alter table public.crm_outbound_webhook_deliveries enable row level security;

drop policy if exists "crm_outbound_webhooks_admin" on public.crm_outbound_webhooks;
create policy "crm_outbound_webhooks_admin" on public.crm_outbound_webhooks
  for all to authenticated using (public.crm_is_unv_admin()) with check (public.crm_is_unv_admin());

-- Entregas: a tela só lê. Quem escreve é o gatilho (security definer) e a edge (service_role).
drop policy if exists "crm_outbound_webhook_deliveries_select_admin" on public.crm_outbound_webhook_deliveries;
create policy "crm_outbound_webhook_deliveries_select_admin" on public.crm_outbound_webhook_deliveries
  for select to authenticated using (public.crm_is_unv_admin());

revoke all on public.crm_outbound_webhooks from anon;
revoke all on public.crm_outbound_webhook_deliveries from anon;
revoke insert, update, delete on public.crm_outbound_webhook_deliveries from authenticated;
grant select, insert, update, delete on public.crm_outbound_webhooks to authenticated;
grant select on public.crm_outbound_webhook_deliveries to authenticated;
grant all on public.crm_outbound_webhooks to service_role;
grant all on public.crm_outbound_webhook_deliveries to service_role;

create or replace function public.crm_webhook_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists crm_webhook_touch_updated_at on public.crm_outbound_webhooks;
create trigger crm_webhook_touch_updated_at before update on public.crm_outbound_webhooks
  for each row execute function public.crm_webhook_touch_updated_at();

-- Enfileira o evento pra cada webhook ativo inscrito nele (e no funil, se o webhook filtra).
create or replace function public.crm_webhook_enqueue(p_event text, p_pipeline_id uuid, p_payload jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.crm_outbound_webhook_deliveries (webhook_id, event, payload)
  select w.id, p_event, p_payload
  from public.crm_outbound_webhooks w
  where w.is_active
    and p_event = any (w.events)
    and (w.pipeline_id is null or w.pipeline_id = p_pipeline_id);
$$;
revoke all on function public.crm_webhook_enqueue(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.crm_webhook_enqueue(text, uuid, jsonb) to service_role;

-- crm_leads: lead.created, lead.stage_changed, lead.won, lead.lost, lead.owner_changed.
-- O payload leva só o que já está na linha (sem join); nomes de funil, etapa e dono a
-- edge resolve na hora de entregar.
create or replace function public.crm_webhook_lead_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead jsonb;
  v_final text;
begin
  -- saída rápida, fora do bloco de exceção (bloco de exceção abre subtransação)
  if new.tenant_id is not null
     or not exists (select 1 from public.crm_outbound_webhooks where is_active) then
    return new;
  end if;

  begin
    v_lead := jsonb_build_object(
      'id', new.id, 'name', new.name, 'phone', new.phone, 'email', new.email, 'company', new.company,
      'pipeline_id', new.pipeline_id, 'stage_id', new.stage_id, 'owner_staff_id', new.owner_staff_id,
      'origin_id', new.origin_id, 'opportunity_value', new.opportunity_value, 'created_at', new.created_at
    );

    if tg_op = 'INSERT' then
      perform public.crm_webhook_enqueue('lead.created', new.pipeline_id, jsonb_build_object('lead', v_lead));
    else
      if new.stage_id is distinct from old.stage_id then
        perform public.crm_webhook_enqueue('lead.stage_changed', new.pipeline_id, jsonb_build_object(
          'lead', v_lead,
          'previous', jsonb_build_object('stage_id', old.stage_id, 'pipeline_id', old.pipeline_id)
        ));
        select s.final_type into v_final from public.crm_stages s where s.id = new.stage_id;
        if v_final in ('won', 'lost') then
          perform public.crm_webhook_enqueue('lead.' || v_final, new.pipeline_id, jsonb_build_object(
            'lead', v_lead,
            'previous', jsonb_build_object('stage_id', old.stage_id, 'pipeline_id', old.pipeline_id)
          ));
        end if;
      end if;
      if new.owner_staff_id is distinct from old.owner_staff_id then
        perform public.crm_webhook_enqueue('lead.owner_changed', new.pipeline_id, jsonb_build_object(
          'lead', v_lead,
          'previous', jsonb_build_object('owner_staff_id', old.owner_staff_id)
        ));
      end if;
    end if;
  exception when others then
    raise warning 'crm_webhook_lead_trigger falhou: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists crm_webhook_lead_insert on public.crm_leads;
create trigger crm_webhook_lead_insert
  after insert on public.crm_leads
  for each row execute function public.crm_webhook_lead_trigger();

-- AFTER UPDATE sem lista de colunas de propósito: pega também mudança feita por gatilho
-- BEFORE. O WHEN barra todo update que não mexe em etapa nem dono sem nem chamar a função.
drop trigger if exists crm_webhook_lead_update on public.crm_leads;
create trigger crm_webhook_lead_update
  after update on public.crm_leads
  for each row
  when (old.stage_id is distinct from new.stage_id or old.owner_staff_id is distinct from new.owner_staff_id)
  execute function public.crm_webhook_lead_trigger();

-- crm_meeting_events: meeting.scheduled, meeting.realized, meeting.no_show.
create or replace function public.crm_webhook_meeting_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
begin
  if not exists (select 1 from public.crm_outbound_webhooks where is_active) then
    return new;
  end if;

  begin
    select l.id, l.name, l.phone, l.email, l.company, l.pipeline_id, l.stage_id, l.owner_staff_id,
           l.origin_id, l.opportunity_value, l.created_at, l.tenant_id
      into v_lead
    from public.crm_leads l where l.id = new.lead_id;
    if v_lead.id is null or v_lead.tenant_id is not null then
      return new;
    end if;

    perform public.crm_webhook_enqueue('meeting.' || new.event_type, new.pipeline_id, jsonb_build_object(
      'meeting', jsonb_build_object(
        'id', new.id, 'event_type', new.event_type, 'event_date', new.event_date,
        'pipeline_id', new.pipeline_id, 'stage_id', new.stage_id,
        'credited_staff_id', new.credited_staff_id, 'owner_staff_id', new.owner_staff_id
      ),
      'lead', jsonb_build_object(
        'id', v_lead.id, 'name', v_lead.name, 'phone', v_lead.phone, 'email', v_lead.email, 'company', v_lead.company,
        'pipeline_id', v_lead.pipeline_id, 'stage_id', v_lead.stage_id, 'owner_staff_id', v_lead.owner_staff_id,
        'origin_id', v_lead.origin_id, 'opportunity_value', v_lead.opportunity_value, 'created_at', v_lead.created_at
      )
    ));
  exception when others then
    raise warning 'crm_webhook_meeting_trigger falhou: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists crm_webhook_meeting_insert on public.crm_meeting_events;
create trigger crm_webhook_meeting_insert
  after insert on public.crm_meeting_events
  for each row
  when (new.event_type in ('scheduled', 'realized', 'no_show'))
  execute function public.crm_webhook_meeting_trigger();

-- A edge pega um lote da fila já marcando como "sending" (skip locked: duas execuções
-- sobrepostas não entregam a mesma linha). Linha presa em "sending" há mais de 5 min
-- (execução que morreu) volta pra fila, ou vira falha se já gastou as 5 tentativas.
create or replace function public.crm_webhook_claim_deliveries(p_limit integer default 40)
returns setof public.crm_outbound_webhook_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.crm_outbound_webhook_deliveries
     set status = case when attempts >= 5 then 'failed' else 'retrying' end,
         next_retry_at = case when attempts >= 5 then null else now() end,
         response = coalesce(response, 'Envio interrompido no meio (sem resposta registrada)')
   where status = 'sending' and last_attempt_at < now() - interval '5 minutes';

  return query
  update public.crm_outbound_webhook_deliveries d
     set status = 'sending', attempts = d.attempts + 1, last_attempt_at = now()
   where d.id in (
     select q.id from public.crm_outbound_webhook_deliveries q
      where q.status in ('pending', 'retrying') and q.next_retry_at <= now()
      order by q.next_retry_at
      limit greatest(1, least(coalesce(p_limit, 40), 100))
      for update skip locked
   )
  returning d.*;
end $$;
revoke all on function public.crm_webhook_claim_deliveries(integer) from public, anon, authenticated;
grant execute on function public.crm_webhook_claim_deliveries(integer) to service_role;

-- Segredo do cron: fica só em app_secrets (sem acesso por API). A edge confere por esta
-- função, então não existe cópia do segredo em variável de ambiente.
insert into public.app_secrets (key, value)
select 'crm_webhook_dispatch_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where not exists (select 1 from public.app_secrets where key = 'crm_webhook_dispatch_secret');

create or replace function public.crm_webhook_dispatch_auth(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_secret, '') <> ''
     and exists (select 1 from public.app_secrets where key = 'crm_webhook_dispatch_secret' and value = p_secret);
$$;
revoke all on function public.crm_webhook_dispatch_auth(text) from public, anon, authenticated;
grant execute on function public.crm_webhook_dispatch_auth(text) to service_role;
