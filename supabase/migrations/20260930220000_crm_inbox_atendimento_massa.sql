-- Atendimento (CRM Comercial), item 8 do benchmark Datacrazy + consertos (30/09/2026):
--  * mensagens agendadas de ponta a ponta (colunas novas + índice pro cron)
--  * mesclar conversas duplicadas (merged_into + crm_merge_conversations)
--  * desvincular lead da conversa (unlinked_lead_id + crm_unlink_conversation_lead)
--  * filtros "Em automação" e "Falhas" (crm_inbox_automation_ids / crm_inbox_failed_ids)
--  * ações em massa com contagem por SQL (crm_inbox_bulk)

-- ---------------------------------------------------------------- colunas
alter table public.crm_scheduled_messages
  add column if not exists conversation_id uuid references public.crm_whatsapp_conversations(id) on delete set null,
  add column if not exists official_instance_id uuid references public.whatsapp_official_instances(id) on delete set null,
  add column if not exists sent_message_id uuid,
  add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_crm_scheduled_pending on public.crm_scheduled_messages (scheduled_at) where status = 'pending';
create index if not exists idx_crm_scheduled_conv on public.crm_scheduled_messages (conversation_id) where conversation_id is not null;

alter table public.crm_whatsapp_conversations
  add column if not exists merged_into uuid references public.crm_whatsapp_conversations(id) on delete set null,
  add column if not exists unlinked_lead_id uuid;
create index if not exists idx_wa_conversations_merged on public.crm_whatsapp_conversations (merged_into) where merged_into is not null;

alter table public.instagram_conversations
  add column if not exists unlinked_lead_id uuid;

-- ---------------------------------------------------------------- Em automação
-- Conversa aberta em que um agente de IA está efetivamente respondendo: agente ligado
-- (override enabled ou agente padrão do número sem override desligando) E mandou
-- mensagem como IA nos últimos 7 dias.
create or replace function public.crm_inbox_automation_ids()
returns table(conversation_id uuid)
language sql stable security definer set search_path = public as $$
  with recentes as (
    select distinct m.conversation_id
    from crm_whatsapp_messages m
    where m.direction = 'outbound' and m.is_ai and m.created_at > now() - interval '7 days'
  )
  select c.id
  from recentes r
  join crm_whatsapp_conversations c on c.id = r.conversation_id
  left join crm_ai_agent_conversation_overrides o on o.conversation_id = c.id and o.channel = 'whatsapp'
  where c.status <> 'closed' and c.merged_into is null
    and coalesce(o.enabled, true)
    and (
      o.agent_id is not null
      or exists (
        select 1 from crm_ai_agent_channels ch join crm_ai_agents a on a.id = ch.agent_id and a.is_active
        where (ch.channel = 'whatsapp' and ch.instance_id = c.instance_id)
           or (ch.channel = 'whatsapp_official' and ch.instance_id = c.official_instance_id)
      )
    )
    and exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active);
$$;
grant execute on function public.crm_inbox_automation_ids() to authenticated;

-- ---------------------------------------------------------------- Falhas
-- Última mensagem ENVIADA da conversa (30 dias) está com status failed.
create or replace function public.crm_inbox_failed_ids()
returns table(conversation_id uuid)
language sql stable security definer set search_path = public as $$
  select x.conversation_id from (
    select distinct on (m.conversation_id) m.conversation_id, m.status
    from crm_whatsapp_messages m
    where m.direction = 'outbound' and m.created_at > now() - interval '30 days' and coalesce(m.type, '') <> 'reaction'
    order by m.conversation_id, m.created_at desc
  ) x
  where x.status = 'failed'
    and exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active);
$$;
grant execute on function public.crm_inbox_failed_ids() to authenticated;

-- ---------------------------------------------------------------- Desvincular lead
create or replace function public.crm_unlink_conversation_lead(p_conversation_id uuid, p_channel text default 'whatsapp')
returns json
language plpgsql security definer set search_path = public as $$
declare
  st record; v_lead uuid; v_nome text; v_tel text; v_lead_nome text;
begin
  select os.id, os.role into st from onboarding_staff os where os.user_id = auth.uid() and os.is_active limit 1;
  if st.id is null then raise exception 'sem acesso ao CRM'; end if;

  if p_channel = 'instagram' then
    select c.lead_id, ct.name, ct.username into v_lead, v_nome, v_tel
      from instagram_conversations c left join instagram_contacts ct on ct.id = c.contact_id where c.id = p_conversation_id;
  else
    select c.lead_id, ct.name, ct.phone into v_lead, v_nome, v_tel
      from crm_whatsapp_conversations c left join crm_whatsapp_contacts ct on ct.id = c.contact_id where c.id = p_conversation_id;
  end if;
  if v_lead is null then raise exception 'Esta conversa não está vinculada a nenhum lead'; end if;
  select name into v_lead_nome from crm_leads where id = v_lead;

  if p_channel = 'instagram' then
    update instagram_conversations set lead_id = null, unlinked_lead_id = v_lead where id = p_conversation_id;
  else
    update crm_whatsapp_conversations set lead_id = null, unlinked_lead_id = v_lead, updated_at = now() where id = p_conversation_id;
    -- o contato também guarda lead_id; se apontava pra este lead, solta
    update crm_whatsapp_contacts ct set lead_id = null
      from crm_whatsapp_conversations c where c.id = p_conversation_id and ct.id = c.contact_id and ct.lead_id = v_lead;
  end if;

  insert into crm_lead_history (lead_id, action, field_changed, old_value, new_value, notes, staff_id)
  values (v_lead, 'unlink', 'conversation', p_conversation_id::text, null,
    'Conversa do ' || case when p_channel = 'instagram' then 'Instagram' else 'WhatsApp' end
      || ' desvinculada pelo Atendimento (' || coalesce(nullif(v_nome, ''), 'sem nome') || case when v_tel is not null then ', ' || v_tel else '' end || ')',
    st.id);

  return json_build_object('success', true, 'lead_id', v_lead, 'lead_name', v_lead_nome);
end $$;
grant execute on function public.crm_unlink_conversation_lead(uuid, text) to authenticated;

-- ---------------------------------------------------------------- Mesclar conversas
-- Move tudo da secundária pra principal (mensagens, agente, agendadas, execuções),
-- herda lead/atendente/setor quando a principal não tem, recalcula a última mensagem,
-- e marca a secundária com merged_into (ela some da lista). Caso Be Gym: mesmo número
-- em dois canais (Evolution e API oficial) vira uma conversa só.
create or replace function public.crm_merge_conversations(p_primary uuid, p_secondary uuid, p_force boolean default false)
returns json
language plpgsql security definer set search_path = public as $$
declare
  st record; p crm_whatsapp_conversations; s crm_whatsapp_conversations;
  p_tel text; s_tel text; p_nome text; s_nome text; pt uuid; stt uuid;
  n_msgs int := 0; n_runs int := 0; n_sched int := 0; n_sug int := 0; n_auto int := 0; n_kw int := 0; n_camp int := 0;
  v_lead uuid;
begin
  select os.id, os.role, os.tenant_id into st from onboarding_staff os where os.user_id = auth.uid() and os.is_active limit 1;
  if st.id is null then raise exception 'sem acesso ao CRM'; end if;
  if p_primary is null or p_secondary is null or p_primary = p_secondary then raise exception 'Escolha duas conversas diferentes'; end if;

  select * into p from crm_whatsapp_conversations where id = p_primary for update;
  select * into s from crm_whatsapp_conversations where id = p_secondary for update;
  if p.id is null or s.id is null then raise exception 'Conversa não encontrada'; end if;
  if p.merged_into is not null then raise exception 'A conversa principal já foi mesclada em outra'; end if;
  if s.merged_into is not null then raise exception 'A conversa secundária já foi mesclada em outra'; end if;

  -- mesma empresa (pelo número de WhatsApp de cada conversa)
  select tenant_id into pt from whatsapp_instances where id = p.instance_id;
  select tenant_id into stt from whatsapp_instances where id = s.instance_id;
  if pt is not null and stt is not null and pt <> stt then raise exception 'As conversas são de empresas diferentes'; end if;
  if st.tenant_id is not null and ((pt is not null and pt <> st.tenant_id) or (stt is not null and stt <> st.tenant_id)) then
    raise exception 'Sem acesso a uma das conversas';
  end if;

  select regexp_replace(coalesce(phone, ''), '\D', '', 'g'), name into p_tel, p_nome from crm_whatsapp_contacts where id = p.contact_id;
  select regexp_replace(coalesce(phone, ''), '\D', '', 'g'), name into s_tel, s_nome from crm_whatsapp_contacts where id = s.contact_id;
  if not p_force and (p_tel = '' or s_tel = '' or right(p_tel, 8) <> right(s_tel, 8)) then
    raise exception 'Os telefones das duas conversas são diferentes (% e %). Confirme que é a mesma pessoa pra mesclar.', coalesce(nullif(p_tel, ''), '?'), coalesce(nullif(s_tel, ''), '?');
  end if;

  update crm_whatsapp_messages set conversation_id = p_primary where conversation_id = p_secondary;
  get diagnostics n_msgs = row_count;
  update crm_ai_agent_runs set conversation_id = p_primary where conversation_id = p_secondary;
  get diagnostics n_runs = row_count;
  update crm_scheduled_messages set conversation_id = p_primary where conversation_id = p_secondary;
  get diagnostics n_sched = row_count;
  update crm_ai_suggested_replies set conversation_id = p_primary where conversation_id = p_secondary;
  get diagnostics n_sug = row_count;
  update crm_automation_runs set conversation_id = p_primary where conversation_id = p_secondary;
  get diagnostics n_auto = row_count;
  update crm_keyword_trigger_logs set conversation_id = p_primary where conversation_id = p_secondary;
  get diagnostics n_kw = row_count;
  update whatsapp_official_campaign_recipients set conversation_id = p_primary where conversation_id = p_secondary;
  get diagnostics n_camp = row_count;

  -- configuração do agente: a principal manda; só herda se não tiver a sua
  delete from crm_ai_agent_conversation_overrides o
   where o.conversation_id = p_secondary
     and exists (select 1 from crm_ai_agent_conversation_overrides x where x.conversation_id = p_primary and x.channel = o.channel);
  update crm_ai_agent_conversation_overrides set conversation_id = p_primary where conversation_id = p_secondary;

  update crm_whatsapp_conversations set
    lead_id = coalesce(p.lead_id, s.lead_id),
    assigned_to = coalesce(p.assigned_to, s.assigned_to),
    sector_id = coalesce(p.sector_id, s.sector_id),
    project_id = coalesce(p.project_id, s.project_id),
    unread_count = coalesce(p.unread_count, 0) + coalesce(s.unread_count, 0),
    status = case when p.status = 'closed' and s.status <> 'closed' then s.status else p.status end,
    instance_id = case when p.instance_id is null and p.official_instance_id is null then s.instance_id else p.instance_id end,
    official_instance_id = case when p.instance_id is null and p.official_instance_id is null then s.official_instance_id else p.official_instance_id end,
    signature_enabled = coalesce(p.signature_enabled, s.signature_enabled),
    updated_at = now()
  where id = p_primary;

  -- contato: nome vazio na principal ganha o da secundária
  if (p_nome is null or p_nome = '' or p_nome !~ '[[:alpha:]]') and s_nome is not null and s_nome ~ '[[:alpha:]]' then
    update crm_whatsapp_contacts set name = s_nome where id = p.contact_id;
  end if;

  -- última mensagem recalculada com o histórico junto
  update crm_whatsapp_conversations c set
    last_message_at = m.created_at,
    last_message = left(m.content, 255),
    last_message_direction = m.direction,
    last_inbound_at = (select max(created_at) from crm_whatsapp_messages where conversation_id = p_primary and direction = 'inbound')
  from (
    select created_at, content, direction from crm_whatsapp_messages
    where conversation_id = p_primary and coalesce(type, '') <> 'reaction'
    order by created_at desc limit 1
  ) m
  where c.id = p_primary;

  update crm_whatsapp_conversations
     set merged_into = p_primary, status = 'closed', unread_count = 0, updated_at = now()
   where id = p_secondary;

  select lead_id into v_lead from crm_whatsapp_conversations where id = p_primary;
  if v_lead is not null then
    insert into crm_lead_history (lead_id, action, field_changed, old_value, new_value, notes, staff_id)
    values (v_lead, 'merge', 'conversation', p_secondary::text, p_primary::text,
      'Conversas do WhatsApp mescladas no Atendimento: ' || n_msgs || ' mensagens de "' || coalesce(nullif(s_nome, ''), s_tel) || '" passaram para a conversa principal',
      st.id);
  end if;

  return json_build_object('success', true, 'primary', p_primary, 'secondary', p_secondary,
    'messages_moved', n_msgs, 'agent_runs_moved', n_runs, 'scheduled_moved', n_sched,
    'suggested_moved', n_sug, 'automation_runs_moved', n_auto, 'keyword_logs_moved', n_kw, 'campaign_recipients_moved', n_camp,
    'lead_id', v_lead);
end $$;
grant execute on function public.crm_merge_conversations(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------- Ações em massa
-- p_ids: conversas marcadas; vazio = todas as que batem com p_filter (mesmo filtro da lista).
-- p_dry_run = true só conta (a confirmação mostra a contagem vinda daqui, não da lista).
create or replace function public.crm_inbox_bulk(
  p_action text,
  p_ids uuid[] default null,
  p_filter jsonb default '{}'::jsonb,
  p_params jsonb default '{}'::jsonb,
  p_dry_run boolean default false
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  st record;
  vis_evo uuid[]; vis_off uuid[];
  ids uuid[];
  n int := 0; n_skip int := 0; n_leads int := 0;
  v_quick text := coalesce(p_filter->>'quick', 'all');
  v_search text := nullif(btrim(coalesce(p_filter->>'search', '')), '');
  v_status text := nullif(p_filter->>'status', '');
  v_inst text := nullif(p_filter->>'instance', '');
  v_inst2 text := nullif(p_filter->>'instance2', '');
  v_assigned uuid := nullif(p_filter->>'assigned_to', '')::uuid;
  v_sector uuid := nullif(p_filter->>'sector_id', '')::uuid;
  v_has_deal text := nullif(p_filter->>'has_deal', '');
  v_pipes uuid[] := case when jsonb_typeof(p_filter->'pipelines') = 'array' then array(select (x)::uuid from jsonb_array_elements_text(p_filter->'pipelines') x) else null end;
  v_stages uuid[] := case when jsonb_typeof(p_filter->'stages') = 'array' then array(select (x)::uuid from jsonb_array_elements_text(p_filter->'stages') x) else null end;
  v_created date := nullif(p_filter->>'created_at', '')::date;
  v_last_from date := nullif(p_filter->>'last_from', '')::date;
  v_last_to date := nullif(p_filter->>'last_to', '')::date;
  v_agent text := nullif(p_filter->>'ai_agent', '');
  v_channel text := coalesce(p_filter->>'channel', 'all');
  v_staff_param uuid; v_sector_param uuid; v_tag uuid; v_pipe uuid; v_stage uuid; v_origin uuid;
  r record; v_new_lead uuid; v_tel text;
begin
  select os.id, os.role, os.tenant_id into st from onboarding_staff os where os.user_id = auth.uid() and os.is_active limit 1;
  if st.id is null then raise exception 'sem acesso ao CRM'; end if;
  if p_action not in ('count','close','reopen','assign','sector','tag','read','hide','unhide','agent_on','agent_off','link_pipeline') then
    raise exception 'Ação desconhecida: %', p_action;
  end if;

  -- números que este usuário enxerga (mesma regra da tela)
  vis_evo := array(select i.id from whatsapp_instances i where i.show_in_inbox
    and (st.role = 'master' or exists (select 1 from whatsapp_instance_access a where a.instance_id = i.id and a.staff_id = st.id and a.can_view)));
  vis_off := array(select i.id from whatsapp_official_instances i where i.show_in_inbox
    and (st.role = 'master' or exists (select 1 from whatsapp_official_instance_access a where a.instance_id = i.id and a.staff_id = st.id and a.can_view)));

  if p_ids is not null and array_length(p_ids, 1) > 0 then
    ids := array(
      select c.id from crm_whatsapp_conversations c
      where c.id = any(p_ids) and c.merged_into is null
        and ((c.instance_id is not null and c.instance_id = any(vis_evo))
          or (c.instance_id is null and c.official_instance_id is not null and c.official_instance_id = any(vis_off))
          or (c.instance_id is null and c.official_instance_id is null and st.role in ('admin', 'master')))
    );
  elsif v_channel = 'instagram' then
    ids := '{}';
  else
    ids := array(
      select c.id
      from crm_whatsapp_conversations c
      join crm_whatsapp_contacts ct on ct.id = c.contact_id
      left join crm_leads l on l.id = c.lead_id
      left join crm_stages sg on sg.id = l.stage_id
      where c.merged_into is null
        and ((c.instance_id is not null and c.instance_id = any(vis_evo))
          or (c.instance_id is null and c.official_instance_id is not null and c.official_instance_id = any(vis_off))
          or (c.instance_id is null and c.official_instance_id is null and st.role in ('admin', 'master')))
        -- ocultas: só na aba "Ocultas"; fora dela ficam de fora
        and (case when v_quick = 'hidden'
              then exists (select 1 from crm_whatsapp_ignored_chats g where g.phone = ct.phone)
              else not exists (select 1 from crm_whatsapp_ignored_chats g where g.phone = ct.phone) end)
        and (v_quick <> 'unread' or coalesce(c.unread_count, 0) > 0)
        and (v_quick <> 'mine' or c.assigned_to = st.id)
        and (v_quick <> 'waiting' or (
              c.status <> 'closed' and c.last_message_at > now() - interval '7 days' and c.last_message_direction = 'inbound'
              and (c.waiting_seen_at is null or c.last_inbound_at is null or c.waiting_seen_at < c.last_inbound_at)
              and coalesce(sg.final_type, '') <> 'lost'))
        and (v_quick <> 'automation' or c.id in (select conversation_id from crm_inbox_automation_ids()))
        and (v_quick <> 'failed' or c.id in (select conversation_id from crm_inbox_failed_ids()))
        and (v_status is null or c.status = v_status)
        and (v_inst is null
             or (v_inst like 'evo:%' and c.instance_id = substr(v_inst, 5)::uuid)
             or (v_inst like 'off:%' and c.instance_id is null and c.official_instance_id = substr(v_inst, 5)::uuid))
        and (v_inst2 is null
             or (v_inst2 like 'evo:%' and c.instance_id = substr(v_inst2, 5)::uuid)
             or (v_inst2 like 'off:%' and c.official_instance_id = substr(v_inst2, 5)::uuid))
        and (not coalesce((p_filter->>'assigned_to_me')::boolean, false) or c.assigned_to = st.id)
        and (not coalesce((p_filter->>'unassigned')::boolean, false) or c.assigned_to is null)
        and (not coalesce((p_filter->>'read')::boolean, false) or coalesce(c.unread_count, 0) = 0)
        and (not coalesce((p_filter->>'unread')::boolean, false) or coalesce(c.unread_count, 0) > 0)
        and (v_assigned is null or c.assigned_to = v_assigned)
        and (v_sector is null or c.sector_id = v_sector)
        and (v_has_deal is null or (v_has_deal = 'with' and c.lead_id is not null) or (v_has_deal = 'without' and c.lead_id is null))
        and (v_pipes is null or array_length(v_pipes, 1) is null or sg.pipeline_id = any(v_pipes))
        and (v_stages is null or array_length(v_stages, 1) is null or l.stage_id = any(v_stages))
        and (v_created is null or (c.created_at at time zone 'America/Sao_Paulo')::date = v_created)
        and (v_last_from is null or (c.last_message_at at time zone 'America/Sao_Paulo')::date >= v_last_from)
        and (v_last_to is null or (c.last_message_at at time zone 'America/Sao_Paulo')::date <= v_last_to)
        and (v_agent is null or c.id in (select conversation_id from crm_agent_conversation_ids(case when v_agent = 'any' then null else v_agent::uuid end)))
        and (v_search is null
             or ct.name ilike '%' || v_search || '%' or ct.phone ilike '%' || v_search || '%'
             or l.name ilike '%' || v_search || '%' or l.company ilike '%' || v_search || '%')
    );
  end if;

  n := coalesce(array_length(ids, 1), 0);
  if p_dry_run or p_action = 'count' then
    return json_build_object('count', n);
  end if;
  if n = 0 then return json_build_object('count', 0, 'affected', 0); end if;

  if p_action = 'close' then
    update crm_whatsapp_conversations set status = 'closed', updated_at = now() where id = any(ids) and status <> 'closed';
    get diagnostics n = row_count;
  elsif p_action = 'reopen' then
    update crm_whatsapp_conversations set status = 'open', updated_at = now() where id = any(ids) and status <> 'open';
    get diagnostics n = row_count;
  elsif p_action = 'assign' then
    v_staff_param := nullif(p_params->>'staff_id', '')::uuid;
    update crm_whatsapp_conversations set assigned_to = v_staff_param, updated_at = now() where id = any(ids);
    get diagnostics n = row_count;
  elsif p_action = 'sector' then
    v_sector_param := nullif(p_params->>'sector_id', '')::uuid;
    update crm_whatsapp_conversations set sector_id = v_sector_param, updated_at = now() where id = any(ids);
    get diagnostics n = row_count;
  elsif p_action = 'tag' then
    v_tag := nullif(p_params->>'tag_id', '')::uuid;
    if v_tag is null then raise exception 'Escolha a etiqueta'; end if;
    insert into crm_lead_tags (lead_id, tag_id)
    select distinct c.lead_id, v_tag from crm_whatsapp_conversations c where c.id = any(ids) and c.lead_id is not null
    on conflict (lead_id, tag_id) do nothing;
    get diagnostics n = row_count;
    select count(*) into n_skip from crm_whatsapp_conversations c where c.id = any(ids) and c.lead_id is null;
  elsif p_action = 'read' then
    update crm_whatsapp_conversations set unread_count = 0, updated_at = now() where id = any(ids) and coalesce(unread_count, 0) > 0;
    get diagnostics n = row_count;
  elsif p_action = 'hide' then
    insert into crm_whatsapp_ignored_chats (phone, name, created_by)
    select distinct on (ct.phone) ct.phone, ct.name, st.id
    from crm_whatsapp_conversations c join crm_whatsapp_contacts ct on ct.id = c.contact_id
    where c.id = any(ids) and coalesce(ct.phone, '') <> ''
    on conflict (phone) do nothing;
    get diagnostics n = row_count;
  elsif p_action = 'unhide' then
    delete from crm_whatsapp_ignored_chats g
    where g.phone in (select ct.phone from crm_whatsapp_conversations c join crm_whatsapp_contacts ct on ct.id = c.contact_id where c.id = any(ids));
    get diagnostics n = row_count;
  elsif p_action in ('agent_on', 'agent_off') then
    insert into crm_ai_agent_conversation_overrides (conversation_id, channel, agent_id, enabled, updated_by, updated_at)
    select c.id, 'whatsapp', null, (p_action = 'agent_on'), st.id, now() from crm_whatsapp_conversations c where c.id = any(ids)
    on conflict (conversation_id, channel) do update
      set enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
    get diagnostics n = row_count;
  elsif p_action = 'link_pipeline' then
    v_pipe := nullif(p_params->>'pipeline_id', '')::uuid;
    v_stage := nullif(p_params->>'stage_id', '')::uuid;
    if v_pipe is null or v_stage is null then raise exception 'Escolha o funil e a etapa'; end if;
    if not exists (select 1 from crm_stages where id = v_stage and pipeline_id = v_pipe) then raise exception 'A etapa não é deste funil'; end if;
    select id into v_origin from crm_origins where pipeline_id = v_pipe and is_active order by sort_order, created_at limit 1;
    if v_origin is null then raise exception 'Este funil não tem origem cadastrada (Configurações do CRM)'; end if;
    n := 0;
    select count(*) into n_skip from crm_whatsapp_conversations c where c.id = any(ids) and c.lead_id is not null;
    for r in
      select c.id, c.assigned_to, ct.name, ct.phone
      from crm_whatsapp_conversations c join crm_whatsapp_contacts ct on ct.id = c.contact_id
      where c.id = any(ids) and c.lead_id is null
    loop
      v_tel := regexp_replace(coalesce(r.phone, ''), '\D', '', 'g');
      -- grupo de WhatsApp não vira lead
      if v_tel = '' or v_tel like '120363%' then n_skip := n_skip + 1; continue; end if;
      insert into crm_leads (name, phone, company, owner_staff_id, created_by, origin_id, pipeline_id, stage_id, entered_pipeline_at, stage_entered_at)
      values (coalesce(nullif(btrim(r.name), ''), v_tel), v_tel, '', coalesce(r.assigned_to, st.id), st.id, v_origin, v_pipe, v_stage, now(), now())
      returning id into v_new_lead;
      update crm_whatsapp_conversations set lead_id = v_new_lead, unlinked_lead_id = null, updated_at = now() where id = r.id;
      insert into crm_lead_history (lead_id, action, notes, staff_id)
      values (v_new_lead, 'note', 'Lead criado em massa pelo Atendimento a partir da conversa do WhatsApp', st.id);
      n := n + 1; n_leads := n_leads + 1;
    end loop;
  end if;

  return json_build_object('count', coalesce(array_length(ids, 1), 0), 'affected', n, 'skipped', n_skip, 'leads_created', n_leads);
end $$;
grant execute on function public.crm_inbox_bulk(text, uuid[], jsonb, jsonb, boolean) to authenticated;
