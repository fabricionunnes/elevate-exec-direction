-- 18/11/2026 (Fabrício: "quando cliente é movido de funil está disparando nova venda no grupo integração, tá errado isso").
-- Ação em massa "Mudar de funil" do Atendimento não mexe em lead que está em etapa de ganho.
-- O disparo oficial ganhou a mesma trava (official-campaign-dispatch v43).
CREATE OR REPLACE FUNCTION public.crm_inbox_bulk(p_action text, p_ids uuid[] DEFAULT NULL::uuid[], p_filter jsonb DEFAULT '{}'::jsonb, p_params jsonb DEFAULT '{}'::jsonb, p_dry_run boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_disparo uuid := nullif(p_filter->>'disparo', '')::uuid;
  v_agent_set uuid; n_moved int := 0;
  v_channel text := coalesce(p_filter->>'channel', 'all');
  v_staff_param uuid; v_sector_param uuid; v_tag uuid; v_pipe uuid; v_stage uuid; v_origin uuid;
  r record; v_new_lead uuid; v_tel text;
begin
  select os.id, os.role, os.tenant_id into st from onboarding_staff os where os.user_id = auth.uid() and os.is_active limit 1;
  if st.id is null then raise exception 'sem acesso ao CRM'; end if;
  if p_action not in ('count','close','reopen','assign','sector','tag','read','hide','unhide','agent_on','agent_off','agent_set','link_pipeline','move_pipeline') then
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
        and (v_disparo is null or c.id in (select wr.conversation_id from whatsapp_official_campaign_recipients wr where wr.campaign_id = v_disparo and wr.conversation_id is not null))
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
  elsif p_action = 'agent_set' then
    -- 17/11/2026: trocar o agente de IA de várias conversas de uma vez. O agente fica FIXO na conversa
    -- (mesmo efeito de escolher o agente no disparo): só ele responde, até alguém desligar ou trocar.
    v_agent_set := nullif(p_params->>'agent_id', '')::uuid;
    if v_agent_set is null then raise exception 'Escolha o agente'; end if;
    if not exists (select 1 from crm_ai_agents a where a.id = v_agent_set and a.is_active) then raise exception 'Agente não encontrado ou inativo'; end if;
    insert into crm_ai_agent_conversation_overrides (conversation_id, channel, agent_id, enabled, reply_mode, locked, updated_by, updated_at)
    select c.id, 'whatsapp', v_agent_set, true, 'auto', true, st.id, now() from crm_whatsapp_conversations c where c.id = any(ids)
    on conflict (conversation_id, channel) do update
      set agent_id = excluded.agent_id, enabled = true, reply_mode = 'auto', locked = true, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
    get diagnostics n = row_count;
  elsif p_action in ('link_pipeline', 'move_pipeline') then
    v_pipe := nullif(p_params->>'pipeline_id', '')::uuid;
    v_stage := nullif(p_params->>'stage_id', '')::uuid;
    if v_pipe is null or v_stage is null then raise exception 'Escolha o funil e a etapa'; end if;
    if not exists (select 1 from crm_stages where id = v_stage and pipeline_id = v_pipe) then raise exception 'A etapa não é deste funil'; end if;
    select id into v_origin from crm_origins where pipeline_id = v_pipe and is_active order by sort_order, created_at limit 1;
    if v_origin is null then raise exception 'Este funil não tem origem cadastrada (Configurações do CRM)'; end if;
    n := 0;
    if p_action = 'move_pipeline' then
      -- 17/11/2026: mudar de funil em massa. Quem já tem negócio vai pro funil e etapa escolhidos (os gatilhos
      -- do lead registram a troca e acertam a origem); quem não tem ganha o negócio já na etapa, como no vincular.
      update crm_leads l set pipeline_id = v_pipe, stage_id = v_stage
       where l.id in (select distinct c.lead_id from crm_whatsapp_conversations c where c.id = any(ids) and c.lead_id is not null)
         and (l.pipeline_id is distinct from v_pipe or l.stage_id is distinct from v_stage)
         -- 18/11/2026: cliente ganho não muda de funil em massa. Sair de "Fechado" apaga a venda, e voltar conta venda nova.
         and not exists (select 1 from crm_stages sg where sg.id = l.stage_id and sg.final_type = 'won');
      get diagnostics n_moved = row_count;
    else
      select count(*) into n_skip from crm_whatsapp_conversations c where c.id = any(ids) and c.lead_id is not null;
    end if;
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
    n := n + n_moved;
  end if;

  return json_build_object('count', coalesce(array_length(ids, 1), 0), 'affected', n, 'skipped', n_skip, 'leads_created', n_leads, 'leads_moved', n_moved);
end $function$
;
