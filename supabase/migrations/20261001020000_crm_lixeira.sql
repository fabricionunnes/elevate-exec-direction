-- Lixeira do CRM (autorizada pelo Fabrício em 01/10/2026): lead, funil e etapa
-- excluídos ficam guardados por 7 dias e podem ser restaurados com o que estava
-- pendurado neles (atividades, histórico, etiquetas, arquivos, propostas...).
-- Antes, excluir era definitivo.
--
-- Um gatilho BEFORE DELETE guarda a linha e as linhas filhas (as que o ON
-- DELETE CASCADE apagaria) em jsonb, mais os ids das tabelas que só perdem o
-- vínculo (ON DELETE SET NULL, ex. conversas do WhatsApp). A restauração
-- reinsere tudo com os mesmos ids, com os gatilhos de usuário desligados
-- durante a reinserção: senão o lead "nasceria" de novo (evento pra Meta,
-- rodízio de responsável, inscrição em cadência).

create table if not exists public.crm_trash (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('lead','pipeline','stage')),
  entity_id uuid not null,
  label text,
  data jsonb not null,
  children jsonb not null default '{}'::jsonb,
  links jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  tenant_id uuid,
  deleted_by uuid,
  deleted_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by uuid,
  expires_at timestamptz not null default now() + interval '7 days'
);
create index if not exists crm_trash_deleted_at_idx on public.crm_trash (deleted_at desc);
create index if not exists crm_trash_entity_idx on public.crm_trash (entity, entity_id);

alter table public.crm_trash enable row level security;
create policy "crm_trash admin le" on public.crm_trash for select to authenticated using (public.crm_is_settings_admin());
create policy "crm_trash admin apaga" on public.crm_trash for delete to authenticated using (public.crm_is_settings_admin());
grant select, delete on public.crm_trash to authenticated;
grant all on public.crm_trash to service_role;

-- índices que faltavam nas colunas de vínculo (o gatilho consulta cada uma por lead)
create index if not exists crm_activity_history_lead_id_idx on public.crm_activity_history (lead_id);
create index if not exists crm_attachments_lead_id_idx on public.crm_attachments (lead_id);
create index if not exists crm_automation_runs_lead_id_idx on public.crm_automation_runs (lead_id);
create index if not exists crm_dialer_queue_lead_id_idx on public.crm_dialer_queue (lead_id);
create index if not exists crm_forecasts_lead_id_idx on public.crm_forecasts (lead_id);
create index if not exists crm_lead_files_lead_id_idx on public.crm_lead_files (lead_id);
create index if not exists crm_lead_form_answers_lead_id_idx on public.crm_lead_form_answers (lead_id);
create index if not exists crm_scheduled_calls_lead_id_idx on public.crm_scheduled_calls (lead_id);
create index if not exists instagram_conversations_lead_id_idx on public.instagram_conversations (lead_id);
create index if not exists media_transcriptions_lead_id_idx on public.media_transcriptions (lead_id);
create index if not exists onboarding_projects_crm_lead_id_idx on public.onboarding_projects (crm_lead_id);

-- tabelas filhas do lead (apagadas em cascata) e tabelas que só perdem o vínculo
create or replace function public.crm_trash_lead_children() returns jsonb language sql immutable as $$
  select '[["crm_activities","lead_id"],["crm_activity_history","lead_id"],["crm_attachments","lead_id"],
    ["crm_cadence_enrollments","lead_id"],["crm_cadence_messages","lead_id"],["crm_calls","lead_id"],
    ["crm_custom_field_values","lead_id"],["crm_dialer_queue","lead_id"],["crm_forecasts","lead_id"],
    ["crm_lead_access_requests","lead_id"],["crm_lead_checklist_checks","lead_id"],["crm_lead_files","lead_id"],
    ["crm_lead_followups","lead_id"],["crm_lead_form_answers","lead_id"],["crm_lead_history","lead_id"],
    ["crm_lead_maturity","lead_id"],["crm_lead_payments","lead_id"],["crm_lead_summaries","lead_id"],
    ["crm_lead_tags","lead_id"],["crm_meeting_events","lead_id"],["crm_notification_queue","lead_id"],
    ["crm_scheduled_calls","lead_id"],["crm_won_notifications","lead_id"],["crm_clint_sync_log","crm_lead_id"]]'::jsonb
$$;
create or replace function public.crm_trash_lead_links() returns jsonb language sql immutable as $$
  select '[["crm_whatsapp_conversations","lead_id"],["crm_whatsapp_contacts","lead_id"],["crm_transcriptions","lead_id"],
    ["crm_voice_calls","lead_id"],["media_transcriptions","lead_id"],["onboarding_projects","crm_lead_id"],
    ["public_service_purchases","crm_lead_id"],["sales_scanner_submissions","lead_id"],["crm_automation_runs","lead_id"],
    ["instagram_conversations","lead_id"]]'::jsonb
$$;

-- guarda as linhas filhas: {tabela: [linhas]}
create or replace function public.crm_trash_snapshot(p_spec jsonb, p_id uuid, p_via_stage boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; v_rows jsonb; v_out jsonb := '{}'::jsonb; v_sql text;
begin
  for r in select * from jsonb_array_elements(p_spec) loop
    if to_regclass('public.' || (r->>0)) is null then continue; end if;
    begin
      if p_via_stage then
        v_sql := format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from %I t where t.%I in (select id from crm_stages where pipeline_id = $1)', r->>0, r->>1);
      else
        v_sql := format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from %I t where t.%I = $1', r->>0, r->>1);
      end if;
      execute v_sql into v_rows using p_id;
      if jsonb_array_length(v_rows) > 0 then v_out := v_out || jsonb_build_object(r->>0, v_rows); end if;
    exception when others then
      raise warning 'crm_trash_snapshot % (%): %', r->>0, p_id, sqlerrm;
    end;
  end loop;
  return v_out;
end $$;
revoke all on function public.crm_trash_snapshot(jsonb, uuid, boolean) from public, authenticated, anon;

create or replace function public.crm_trash_capture_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_children jsonb; v_links jsonb := '{}'::jsonb; r jsonb; v_ids jsonb; v_label text;
begin
  -- limpeza definitiva (esvaziar lixeira, mesclagem que já guardou o dado) passa direto
  if coalesce(current_setting('crm.trash_skip', true), '') = '1' then return old; end if;
  v_children := crm_trash_snapshot(crm_trash_lead_children(), old.id);
  for r in select * from jsonb_array_elements(crm_trash_lead_links()) loop
    if to_regclass('public.' || (r->>0)) is null then continue; end if;
    begin
      execute format('select coalesce(jsonb_agg(t.id), ''[]''::jsonb) from %I t where t.%I = $1', r->>0, r->>1) into v_ids using old.id;
      if jsonb_array_length(v_ids) > 0 then
        v_links := v_links || jsonb_build_object(r->>0, jsonb_build_object('col', r->>1, 'ids', v_ids));
      end if;
    exception when others then
      raise warning 'crm_trash links % (%): %', r->>0, old.id, sqlerrm;
    end;
  end loop;
  v_label := coalesce(nullif(old.name, ''), old.phone, old.email, old.id::text);
  insert into crm_trash (entity, entity_id, label, data, children, links, deleted_by, tenant_id, meta)
  values ('lead', old.id, v_label, to_jsonb(old), v_children, v_links, auth.uid(), old.tenant_id,
    jsonb_build_object(
      'pipeline', (select name from crm_pipelines where id = old.pipeline_id),
      'stage', (select name from crm_stages where id = old.stage_id),
      'owner', (select name from onboarding_staff where id = old.owner_staff_id),
      'phone', old.phone, 'email', old.email, 'company', old.company,
      'children_count', (select coalesce(sum(jsonb_array_length(e.v)), 0) from jsonb_each(v_children) e(k, v))));
  return old;
exception when others then
  -- a lixeira nunca impede a exclusão
  raise warning 'crm_trash lead %: %', old.id, sqlerrm;
  return old;
end $$;

drop trigger if exists aa_crm_trash_capture on public.crm_leads;
create trigger aa_crm_trash_capture before delete on public.crm_leads
  for each row execute function public.crm_trash_capture_lead();

-- funil: guarda o funil, as etapas e o que pende delas. Os leads do funil caem
-- na lixeira um a um pelo gatilho de cima (cascata) e voltam junto com o funil.
create or replace function public.crm_trash_pipeline_children() returns jsonb language sql immutable as $$
  select '[["crm_stages","pipeline_id"],["crm_lead_distribution","pipeline_id"],["crm_pipeline_forms","pipeline_id"],
    ["crm_notification_rules","pipeline_id"],["crm_ai_agent_pipelines","pipeline_id"],["crm_meta_campaign_pipelines","pipeline_id"],
    ["crm_cadences","pipeline_id"],["crm_pipeline_permissions","pipeline_id"]]'::jsonb
$$;
create or replace function public.crm_trash_stage_children() returns jsonb language sql immutable as $$
  select '[["crm_stage_actions","stage_id"],["crm_stage_checklists","stage_id"]]'::jsonb
$$;

create or replace function public.crm_trash_capture_pipeline() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_children jsonb;
begin
  if coalesce(current_setting('crm.trash_skip', true), '') = '1' then return old; end if;
  v_children := crm_trash_snapshot(crm_trash_pipeline_children(), old.id)
             || crm_trash_snapshot(crm_trash_stage_children(), old.id, true);
  insert into crm_trash (entity, entity_id, label, data, children, deleted_by, tenant_id, meta)
  values ('pipeline', old.id, old.name, to_jsonb(old), v_children, auth.uid(), old.tenant_id,
    jsonb_build_object('stages', (select count(*) from crm_stages where pipeline_id = old.id),
                       'leads', (select count(*) from crm_leads where pipeline_id = old.id)));
  return old;
exception when others then
  raise warning 'crm_trash pipeline %: %', old.id, sqlerrm;
  return old;
end $$;
drop trigger if exists aa_crm_trash_capture on public.crm_pipelines;
create trigger aa_crm_trash_capture before delete on public.crm_pipelines
  for each row execute function public.crm_trash_capture_pipeline();

create or replace function public.crm_trash_capture_stage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('crm.trash_skip', true), '') = '1' then return old; end if;
  -- etapa caindo junto com o funil: o funil já guardou ela
  if not exists (select 1 from crm_pipelines where id = old.pipeline_id) then return old; end if;
  insert into crm_trash (entity, entity_id, label, data, children, deleted_by, tenant_id, meta)
  values ('stage', old.id, old.name, to_jsonb(old), crm_trash_snapshot(crm_trash_stage_children(), old.id), auth.uid(), old.tenant_id,
    jsonb_build_object('pipeline', (select name from crm_pipelines where id = old.pipeline_id)));
  return old;
exception when others then
  raise warning 'crm_trash stage %: %', old.id, sqlerrm;
  return old;
end $$;
drop trigger if exists aa_crm_trash_capture on public.crm_stages;
create trigger aa_crm_trash_capture before delete on public.crm_stages
  for each row execute function public.crm_trash_capture_stage();

-- reinsere linhas de uma tabela a partir do jsonb, com os gatilhos de usuário
-- desligados só durante a reinserção. Devolve quantas entraram.
create or replace function public.crm_trash_reinsert(p_table text, p_rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if to_regclass('public.' || p_table) is null or p_rows is null or jsonb_typeof(p_rows) <> 'array' then return 0; end if;
  execute format('alter table %I disable trigger user', p_table);
  begin
    execute format('insert into %I select * from jsonb_populate_recordset(null::%I, $1) on conflict do nothing', p_table, p_table) using p_rows;
    get diagnostics n = row_count;
  exception when others then
    execute format('alter table %I enable trigger user', p_table);
    raise;
  end;
  execute format('alter table %I enable trigger user', p_table);
  return n;
end $$;
revoke all on function public.crm_trash_reinsert(text, jsonb) from public, authenticated, anon;

create or replace function public.crm_trash_restore(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t crm_trash; v_data jsonb; v_pipe uuid; v_stage uuid; k text; v jsonb; n int;
  v_restored jsonb := '{}'::jsonb; v_err jsonb := '[]'::jsonb; v_staff uuid; v_leads int := 0; l record;
begin
  if auth.uid() is not null and not crm_is_settings_admin() then
    raise exception 'Só administradores restauram itens da lixeira';
  end if;
  select * into t from crm_trash where id = p_id for update;
  if not found then raise exception 'Item não encontrado na lixeira'; end if;
  if t.restored_at is not null then raise exception 'Esse item já foi restaurado'; end if;
  select id into v_staff from onboarding_staff where user_id = auth.uid() limit 1;

  if t.entity = 'lead' then
    v_data := t.data;
    v_pipe := (v_data->>'pipeline_id')::uuid; v_stage := (v_data->>'stage_id')::uuid;
    if exists (select 1 from crm_leads where id = t.entity_id) then raise exception 'Esse lead já existe no CRM'; end if;
    if v_pipe is not null and not exists (select 1 from crm_pipelines where id = v_pipe) then
      raise exception 'O funil deste lead foi excluído. Restaure o funil primeiro.';
    end if;
    if v_stage is not null and not exists (select 1 from crm_stages where id = v_stage) then
      select id into v_stage from crm_stages where pipeline_id = v_pipe order by sort_order limit 1;
      v_data := v_data || jsonb_build_object('stage_id', v_stage);
      v_err := v_err || jsonb_build_object('aviso', 'A etapa original não existe mais; o lead voltou na primeira etapa do funil.');
    end if;
    n := crm_trash_reinsert('crm_leads', jsonb_build_array(v_data));
    if n = 0 then raise exception 'Não consegui reinserir o lead'; end if;
    for k, v in select * from jsonb_each(t.children) loop
      begin
        n := crm_trash_reinsert(k, v);
        v_restored := v_restored || jsonb_build_object(k, n);
      exception when others then
        v_err := v_err || jsonb_build_object('tabela', k, 'erro', sqlerrm);
      end;
    end loop;
    for k, v in select * from jsonb_each(t.links) loop
      begin
        execute format('update %I set %I = $1 where id in (select (x)::uuid from jsonb_array_elements_text($2) x) and %I is null', k, v->>'col', v->>'col')
          using t.entity_id, v->'ids';
        get diagnostics n = row_count;
        v_restored := v_restored || jsonb_build_object(k || ' (vínculo)', n);
      exception when others then
        v_err := v_err || jsonb_build_object('tabela', k, 'erro', sqlerrm);
      end;
    end loop;
    insert into crm_lead_history (lead_id, action, notes, staff_id)
    values (t.entity_id, 'restored', 'Restaurado da lixeira', v_staff);

  elsif t.entity = 'pipeline' then
    if exists (select 1 from crm_pipelines where id = t.entity_id) then raise exception 'Esse funil já existe'; end if;
    n := crm_trash_reinsert('crm_pipelines', jsonb_build_array(t.data));
    if n = 0 then raise exception 'Não consegui reinserir o funil'; end if;
    -- etapas antes do resto (ações e checklists apontam pra elas)
    if t.children ? 'crm_stages' then
      v_restored := v_restored || jsonb_build_object('crm_stages', crm_trash_reinsert('crm_stages', t.children->'crm_stages'));
    end if;
    for k, v in select * from jsonb_each(t.children) loop
      if k = 'crm_stages' then continue; end if;
      begin
        v_restored := v_restored || jsonb_build_object(k, crm_trash_reinsert(k, v));
      exception when others then
        v_err := v_err || jsonb_build_object('tabela', k, 'erro', sqlerrm);
      end;
    end loop;
    -- leads que caíram junto (mesma exclusão, janela de 30 s)
    for l in select id from crm_trash
             where entity = 'lead' and restored_at is null
               and (data->>'pipeline_id')::uuid = t.entity_id
               and deleted_at between t.deleted_at - interval '30 seconds' and t.deleted_at + interval '30 seconds'
    loop
      begin
        perform crm_trash_restore(l.id);
        v_leads := v_leads + 1;
      exception when others then
        v_err := v_err || jsonb_build_object('lead', l.id, 'erro', sqlerrm);
      end;
    end loop;
    v_restored := v_restored || jsonb_build_object('leads', v_leads);

  elsif t.entity = 'stage' then
    if exists (select 1 from crm_stages where id = t.entity_id) then raise exception 'Essa etapa já existe'; end if;
    if not exists (select 1 from crm_pipelines where id = (t.data->>'pipeline_id')::uuid) then
      raise exception 'O funil desta etapa foi excluído. Restaure o funil primeiro.';
    end if;
    n := crm_trash_reinsert('crm_stages', jsonb_build_array(t.data));
    if n = 0 then raise exception 'Não consegui reinserir a etapa'; end if;
    for k, v in select * from jsonb_each(t.children) loop
      begin
        v_restored := v_restored || jsonb_build_object(k, crm_trash_reinsert(k, v));
      exception when others then
        v_err := v_err || jsonb_build_object('tabela', k, 'erro', sqlerrm);
      end;
    end loop;
  end if;

  update crm_trash set restored_at = now(), restored_by = auth.uid() where id = p_id;
  return jsonb_build_object('ok', true, 'entity', t.entity, 'entity_id', t.entity_id, 'restaurado', v_restored, 'avisos', v_err);
end $$;
revoke all on function public.crm_trash_restore(uuid) from public, anon;
grant execute on function public.crm_trash_restore(uuid) to authenticated, service_role;

-- esvaziar: apaga o que passou dos 7 dias e o que já foi restaurado há mais de 7 dias
create or replace function public.crm_trash_purge() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from crm_trash where expires_at < now() or (restored_at is not null and restored_at < now() - interval '7 days');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.crm_trash_purge() from public, authenticated, anon;
grant execute on function public.crm_trash_purge() to service_role;
