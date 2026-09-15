-- Atendimento: buscar lead existente (funil, nome, telefone, instagram) e vincular a conversa mesclando dados

create or replace function public.crm_search_leads_for_link(
  p_search text default null, p_pipeline uuid default null, p_exclude uuid default null, p_limit int default 20)
returns table(id uuid, name text, company text, phone text, email text, instagram text,
  pipeline_id uuid, pipeline_name text, stage_name text, stage_color text, owner_name text, created_at timestamptz,
  segment text, estimated_revenue text, employee_count text, main_pain text, city text, state text,
  urgency text, fit_score int, role text, document text, notes text)
language plpgsql stable security definer set search_path to 'public' as $$
declare st record; v_q text; v_digits text; v_ig text;
begin
  select s.id, s.tenant_id into st from onboarding_staff s
  where s.user_id = auth.uid() and s.is_active = true limit 1;
  if st.id is null then raise exception 'sem acesso ao CRM'; end if;
  v_q := nullif(btrim(coalesce(p_search, '')), '');
  if v_q is null and p_pipeline is null then return; end if;
  v_digits := regexp_replace(coalesce(v_q, ''), '\D', '', 'g');
  v_ig := lower(ltrim(coalesce(v_q, ''), '@'));
  return query
  select l.id, l.name, l.company, l.phone, l.email, l.instagram, l.pipeline_id,
    p.name, s.name, s.color, o.name, l.created_at,
    l.segment, l.estimated_revenue, l.employee_count, l.main_pain, l.city, l.state,
    l.urgency, l.fit_score, l.role, l.document, left(l.notes, 200)
  from crm_leads l
  left join crm_pipelines p on p.id = l.pipeline_id
  left join crm_stages s on s.id = l.stage_id
  left join onboarding_staff o on o.id = l.owner_staff_id
  where l.tenant_id is not distinct from st.tenant_id
    and (p_exclude is null or l.id <> p_exclude)
    and (p_pipeline is null or l.pipeline_id = p_pipeline)
    and (v_q is null
      or l.name ilike '%' || v_q || '%'
      or l.company ilike '%' || v_q || '%'
      or l.email ilike '%' || v_q || '%'
      or (length(v_digits) >= 4 and regexp_replace(coalesce(l.phone, ''), '\D', '', 'g') like '%' || v_digits || '%')
      or (length(v_ig) >= 2 and lower(coalesce(l.instagram, '')) like '%' || v_ig || '%'))
  order by (lower(l.name) = lower(coalesce(v_q, ''))) desc, l.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end $$;

create or replace function public.crm_link_conversation_lead(
  p_conversation_id uuid, p_channel text, p_target uuid,
  p_source uuid default null, p_delete_source boolean default false,
  p_phone text default null, p_instagram text default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  st record; t crm_leads; s crm_leads; r record; c text; n int;
  v_filled text[] := '{}'; v_deleted boolean := false; v_ig text; v_phone text;
  v_campos text[] := array['phone','email','instagram','company','role','city','state','segment',
    'estimated_revenue','employee_count','main_pain','urgency','document','trade_name','cpf','rg','zipcode',
    'address','address_number','address_complement','address_neighborhood','legal_representative_name',
    'marital_status','utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid',
    'ad_name','adset_name','campaign_name','meta_campaign_id','meta_adset_id','meta_ad_id'];
begin
  select os.id, os.role, os.tenant_id into st from onboarding_staff os
  where os.user_id = auth.uid() and os.is_active = true limit 1;
  if st.id is null then raise exception 'sem acesso ao CRM'; end if;

  select * into t from crm_leads where id = p_target and tenant_id is not distinct from st.tenant_id;
  if t.id is null then raise exception 'Lead escolhido não encontrado'; end if;

  if p_source is not null and p_source <> p_target then
    select * into s from crm_leads where id = p_source and tenant_id is not distinct from st.tenant_id;
  end if;

  if s.id is not null then
    -- campos de texto: só preenche o que está vazio no lead escolhido
    foreach c in array v_campos loop
      execute format(
        'update crm_leads tt set %1$I = ss.%1$I from crm_leads ss
         where tt.id = $1 and ss.id = $2 and nullif(btrim(tt.%1$I), '''') is null and nullif(btrim(ss.%1$I), '''') is not null', c)
        using p_target, p_source;
      get diagnostics n = row_count;
      if n > 0 then v_filled := v_filled || c; end if;
    end loop;

    update crm_leads tt set
      fit_score = coalesce(tt.fit_score, s.fit_score),
      has_partner = coalesce(tt.has_partner, s.has_partner),
      ai_brief = coalesce(tt.ai_brief, s.ai_brief),
      ai_brief_at = case when tt.ai_brief is null then s.ai_brief_at else tt.ai_brief_at end,
      opportunity_value = greatest(coalesce(tt.opportunity_value, 0), coalesce(s.opportunity_value, 0)),
      notes = case
        when nullif(btrim(s.notes), '') is null then tt.notes
        when nullif(btrim(tt.notes), '') is null then s.notes
        when position(s.notes in tt.notes) > 0 then tt.notes
        else tt.notes || E'\n---\n' || s.notes end
    where tt.id = p_target;
    if t.fit_score is null and s.fit_score is not null then v_filled := v_filled || 'fit_score'::text; end if;
    if nullif(btrim(t.notes), '') is null and nullif(btrim(s.notes), '') is not null then v_filled := v_filled || 'notes'::text; end if;

    -- campos personalizados (qualificação) e etiquetas
    insert into crm_custom_field_values (lead_id, field_id, value)
    select p_target, field_id, value from crm_custom_field_values
    where lead_id = p_source and nullif(btrim(value), '') is not null
    on conflict (lead_id, field_id) do update set value = excluded.value, updated_at = now()
      where nullif(btrim(crm_custom_field_values.value), '') is null;

    insert into crm_lead_tags (lead_id, tag_id)
    select p_target, tag_id from crm_lead_tags where lead_id = p_source
    on conflict do nothing;
  end if;

  -- dados do próprio contato da conversa
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_phone) >= 8 then
    update crm_leads set phone = v_phone where id = p_target and nullif(btrim(phone), '') is null;
    get diagnostics n = row_count;
    if n > 0 and not ('phone' = any(v_filled)) then v_filled := v_filled || 'phone'::text; end if;
  end if;
  v_ig := nullif(ltrim(btrim(coalesce(p_instagram, '')), '@'), '');
  if v_ig is not null then
    update crm_leads set instagram = v_ig where id = p_target and nullif(btrim(instagram), '') is null;
    get diagnostics n = row_count;
    if n > 0 and not ('instagram' = any(v_filled)) then v_filled := v_filled || 'instagram'::text; end if;
  end if;

  -- vincula a conversa
  if p_channel = 'instagram' then
    update instagram_conversations set lead_id = p_target where id = p_conversation_id;
  else
    update crm_whatsapp_conversations set lead_id = p_target where id = p_conversation_id;
  end if;

  -- absorve o lead atual: move tudo que aponta pra ele e exclui
  if s.id is not null and p_delete_source then
    if not (st.role in ('admin','master','head_comercial','sdr') or s.owner_staff_id is null or s.owner_staff_id = st.id) then
      raise exception 'Sem permissão para excluir o lead atual (é de outro responsável)';
    end if;

    -- remove antes o que já existe no destino (chaves únicas)
    delete from crm_lead_tags x where x.lead_id = p_source;
    delete from crm_custom_field_values x where x.lead_id = p_source;
    delete from crm_lead_checklist_checks x where x.lead_id = p_source
      and exists (select 1 from crm_lead_checklist_checks y where y.lead_id = p_target and y.item_id = x.item_id);
    delete from crm_cadence_enrollments x where x.lead_id = p_source
      and exists (select 1 from crm_cadence_enrollments y where y.lead_id = p_target and y.cadence_id = x.cadence_id);
    delete from crm_dialer_queue x where x.lead_id = p_source
      and exists (select 1 from crm_dialer_queue y where y.lead_id = p_target and y.campaign_id = x.campaign_id);
    delete from crm_lead_summaries x where x.lead_id = p_source
      and exists (select 1 from crm_lead_summaries y where y.lead_id = p_target and y.summary_type = x.summary_type);
    delete from crm_won_notifications x where x.lead_id = p_source
      and exists (select 1 from crm_won_notifications y where y.lead_id = p_target);

    for r in
      select c2.conrelid::regclass::text as tbl, a.attname::text as col
      from pg_constraint c2
      join pg_attribute a on a.attrelid = c2.conrelid and a.attnum = c2.conkey[1]
      where c2.contype = 'f' and c2.confrelid = 'public.crm_leads'::regclass and array_length(c2.conkey, 1) = 1
    loop
      begin
        execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col) using p_target, p_source;
      exception when unique_violation then
        execute format('delete from %s where %I = $1', r.tbl, r.col) using p_source;
      end;
    end loop;

    delete from crm_leads where id = p_source;
    v_deleted := true;
  end if;

  insert into crm_lead_history (lead_id, action, notes, staff_id)
  values (p_target, 'merge',
    case when s.id is not null
      then 'Conversa vinculada pelo Atendimento; dados mesclados do lead "' || coalesce(s.name, '') || '"'
        || case when v_deleted then ' (lead duplicado excluído)' else '' end
      else 'Conversa vinculada pelo Atendimento' end,
    st.id);

  return json_build_object('success', true, 'filled', v_filled, 'deleted_source', v_deleted);
end $$;

grant execute on function public.crm_search_leads_for_link(text, uuid, uuid, int) to authenticated;
grant execute on function public.crm_link_conversation_lead(uuid, text, uuid, uuid, boolean, text, text) to authenticated;
notify pgrst, 'reload schema';
