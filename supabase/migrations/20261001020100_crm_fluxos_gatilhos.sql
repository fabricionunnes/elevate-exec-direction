-- ============================================================================
-- Fluxos do CRM: captura de eventos (segunda parte de 20261001020000).
--
-- crm_leads já carrega ~30 gatilhos (CAPI, distribuição, cadência, won-notify...). Os daqui
-- foram feitos pra custar o mínimo:
--   * só ENFILEIRAM uma linha em crm_flow_events; quem decide e executa é o crm_flow_tick;
--   * sem fluxo ativo daquele tipo, saem na primeira linha (um "exists" numa tabela minúscula);
--   * INSERT em crm_leads e em crm_lead_tags é em nível de comando, com tabela de transição:
--     uma chamada por comando, e é ali que se conta se foi importação/ação em massa (> 20);
--   * UPDATE em crm_leads é por linha, mas com WHEN: a função só é chamada quando a etapa ou
--     o dono mudou de verdade (update de qualquer outro campo não paga nada);
--   * qualquer erro vira WARNING, nunca derruba o insert/update de quem está usando o CRM.
-- lock_timeout: se a tabela estiver ocupada, a migration falha rápido em vez de enfileirar
-- atrás de uma transação longa e travar o CRM.
-- ============================================================================
set local lock_timeout = '4s';

create or replace function public.crm_flow_capture_lead_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare _n int;
begin
  if not exists (select 1 from crm_flows where is_active and trigger_type = 'lead_created') then return null; end if;
  begin
    select count(*) into _n from novos;
    insert into crm_flow_events (tenant_id, lead_id, trigger_type, payload)
    select n.tenant_id, n.id, 'lead_created',
           jsonb_build_object('pipeline_id', n.pipeline_id, 'stage_id', n.stage_id, 'bulk', _n > 20, 'depth', crm_flow_depth())
      from novos n;
  exception when others then
    raise warning 'crm_flow_capture_lead_insert: %', sqlerrm;
  end;
  return null;
end $$;

create or replace function public.crm_flow_capture_lead_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare _types text[]; _nf text; _of text; _d int;
begin
  select array_agg(distinct trigger_type) into _types from crm_flows
   where is_active and trigger_type in ('stage_changed', 'lead_won', 'lead_lost', 'owner_changed');
  if _types is null then return null; end if;
  begin
    _d := crm_flow_depth();
    if new.stage_id is distinct from old.stage_id then
      if 'stage_changed' = any(_types) then
        insert into crm_flow_events (tenant_id, lead_id, trigger_type, payload)
        values (new.tenant_id, new.id, 'stage_changed', jsonb_build_object(
          'from_stage_id', old.stage_id, 'stage_id', new.stage_id,
          'from_pipeline_id', old.pipeline_id, 'pipeline_id', new.pipeline_id, 'depth', _d));
      end if;
      if 'lead_won' = any(_types) or 'lead_lost' = any(_types) then
        select final_type into _nf from crm_stages where id = new.stage_id;
        select final_type into _of from crm_stages where id = old.stage_id;
        if _nf in ('won', 'lost') and _nf is distinct from _of and ('lead_' || _nf) = any(_types) then
          insert into crm_flow_events (tenant_id, lead_id, trigger_type, payload)
          values (new.tenant_id, new.id, 'lead_' || _nf,
                  jsonb_build_object('stage_id', new.stage_id, 'pipeline_id', new.pipeline_id, 'depth', _d));
        end if;
      end if;
    end if;
    if new.owner_staff_id is distinct from old.owner_staff_id and 'owner_changed' = any(_types) then
      insert into crm_flow_events (tenant_id, lead_id, trigger_type, payload)
      values (new.tenant_id, new.id, 'owner_changed',
              jsonb_build_object('from', old.owner_staff_id, 'to', new.owner_staff_id, 'depth', _d));
    end if;
  exception when others then
    raise warning 'crm_flow_capture_lead_update: %', sqlerrm;
  end;
  return null;
end $$;

create or replace function public.crm_flow_capture_tag()
returns trigger language plpgsql security definer set search_path = public as $$
declare _n int;
begin
  if not exists (select 1 from crm_flows where is_active and trigger_type = 'tag_added') then return null; end if;
  begin
    select count(*) into _n from novas;
    insert into crm_flow_events (tenant_id, lead_id, trigger_type, payload)
    select l.tenant_id, n.lead_id, 'tag_added',
           jsonb_build_object('tag_id', n.tag_id, 'bulk', _n > 20, 'depth', crm_flow_depth())
      from novas n join crm_leads l on l.id = n.lead_id;
  exception when others then
    raise warning 'crm_flow_capture_tag: %', sqlerrm;
  end;
  return null;
end $$;

-- Reunião agendada: a atividade de reunião criada no lead
create or replace function public.crm_flow_capture_meeting_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from crm_flows where is_active and trigger_type = 'meeting_scheduled') then return null; end if;
  begin
    insert into crm_flow_events (tenant_id, lead_id, trigger_type, payload)
    select l.tenant_id, new.lead_id, 'meeting_scheduled', jsonb_build_object(
             'activity_id', new.id, 'meeting_at', new.scheduled_at, 'responsible_staff_id', new.responsible_staff_id,
             'depth', crm_flow_depth(),
             'vars', jsonb_build_object(
               'data_reuniao', coalesce(to_char(new.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), ''),
               'hora_reuniao', coalesce(to_char(new.scheduled_at at time zone 'America/Sao_Paulo', 'HH24:MI'), ''),
               'link_reuniao', coalesce(new.meeting_link, '')))
      from crm_leads l where l.id = new.lead_id;
  exception when others then
    raise warning 'crm_flow_capture_meeting_activity: %', sqlerrm;
  end;
  return null;
end $$;

-- Reunião agendada (pela etapa), realizada e no-show: o registro em crm_meeting_events
create or replace function public.crm_flow_capture_meeting_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare _tipo text := case new.event_type
    when 'scheduled' then 'meeting_scheduled'
    when 'realized' then 'meeting_realized'
    when 'realized_out_of_icp' then 'meeting_realized'
    when 'no_show' then 'meeting_no_show' end;
begin
  if _tipo is null then return null; end if;
  if not exists (select 1 from crm_flows where is_active and trigger_type = _tipo) then return null; end if;
  begin
    insert into crm_flow_events (tenant_id, lead_id, trigger_type, payload)
    select l.tenant_id, new.lead_id, _tipo, jsonb_build_object(
             'meeting_event_id', new.id, 'event_type', new.event_type, 'stage_id', new.stage_id,
             'credited_staff_id', new.credited_staff_id, 'depth', crm_flow_depth())
      from crm_leads l where l.id = new.lead_id;
  exception when others then
    raise warning 'crm_flow_capture_meeting_event: %', sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists crm_flow_capture_ins on public.crm_leads;
create trigger crm_flow_capture_ins after insert on public.crm_leads
  referencing new table as novos for each statement execute function public.crm_flow_capture_lead_insert();

drop trigger if exists crm_flow_capture_upd on public.crm_leads;
create trigger crm_flow_capture_upd after update on public.crm_leads
  for each row when (old.stage_id is distinct from new.stage_id or old.owner_staff_id is distinct from new.owner_staff_id)
  execute function public.crm_flow_capture_lead_update();

drop trigger if exists crm_flow_capture_tag on public.crm_lead_tags;
create trigger crm_flow_capture_tag after insert on public.crm_lead_tags
  referencing new table as novas for each statement execute function public.crm_flow_capture_tag();

drop trigger if exists crm_flow_capture_meeting on public.crm_activities;
create trigger crm_flow_capture_meeting after insert on public.crm_activities
  for each row when (new.type = 'meeting' and coalesce(new.status, 'pending') = 'pending')
  execute function public.crm_flow_capture_meeting_activity();

drop trigger if exists crm_flow_capture_meeting_event on public.crm_meeting_events;
create trigger crm_flow_capture_meeting_event after insert on public.crm_meeting_events
  for each row execute function public.crm_flow_capture_meeting_event();
