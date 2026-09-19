-- Automações do CRM: aplicar a regra nas conversas anteriores (19/09/2026)
begin;
drop function if exists public.crm_run_wa_automations(uuid,text,boolean);
CREATE OR REPLACE FUNCTION public.crm_run_wa_automations(p_conversation uuid, p_text text DEFAULT ''::text, p_dry boolean DEFAULT false, p_force boolean DEFAULT false, p_only uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cv record; ct record; au record; v_lead uuid; v_owner uuid; v_staff uuid; v_new_lead boolean;
  c jsonb; a jsonb; v_kw text; v_ok boolean; v_out jsonb := '[]'::jsonb; v_res jsonb; v_stage uuid; v_pipe uuid; v_tag uuid; v_run uuid;
begin
  select * into cv from crm_whatsapp_conversations where id = p_conversation;
  if not found then return v_out; end if;
  select name, phone into ct from crm_whatsapp_contacts where id = cv.contact_id;
  -- nunca em grupo / lista de transmissão
  if coalesce(ct.phone,'') = '' or ct.phone like '%@g.us%' or ct.phone like '%-%' or length(regexp_replace(ct.phone,'\D','','g')) > 15 then return v_out; end if;

  for au in select * from crm_automations where is_active and trigger_type = 'wa_first_inbound' and (p_only is null or id = p_only) order by position, created_at loop
    c := au.conditions; a := au.actions;
    -- uma vez por conversa por regra
    if exists (select 1 from crm_automation_runs r where r.automation_id = au.id and r.conversation_id = cv.id) then continue; end if;
    -- instâncias (vazio = todas)
    v_ok := true;
    if jsonb_array_length(coalesce(c->'instance_ids','[]'::jsonb)) + jsonb_array_length(coalesce(c->'official_instance_ids','[]'::jsonb)) > 0 then
      v_ok := (cv.instance_id is not null and (c->'instance_ids') ? cv.instance_id::text)
           or (cv.official_instance_id is not null and (c->'official_instance_ids') ? cv.official_instance_id::text);
    end if;
    if not v_ok then continue; end if;
    -- só conversas criadas depois que a regra foi ligada (padrão)
    if not p_force and coalesce((c->>'only_new_conversations')::boolean, true) and au.activated_at is not null and cv.created_at < au.activated_at - interval '2 minutes' then continue; end if;
    -- situação do contato
    if coalesce(c->>'lead_state','sem_lead') = 'sem_lead' and cv.lead_id is not null then continue; end if;
    if c->>'lead_state' = 'com_lead' and cv.lead_id is null then continue; end if;
    -- palavras na mensagem (vazio = qualquer mensagem)
    if jsonb_array_length(coalesce(c->'keywords','[]'::jsonb)) > 0 then
      v_ok := false;
      for v_kw in select jsonb_array_elements_text(c->'keywords') loop
        if btrim(v_kw) <> '' and position(lower(btrim(v_kw)) in lower(coalesce(p_text,''))) > 0 then v_ok := true; exit; end if;
      end loop;
      if not v_ok then continue; end if;
    end if;

    v_lead := cv.lead_id; v_new_lead := false; v_staff := null; v_res := jsonb_build_object('automation', au.name);

    -- 1) criar lead
    if v_lead is null and coalesce((a->'create_lead'->>'enabled')::boolean, false) and (a->'create_lead'->>'pipeline_id') is not null then
      v_pipe := (a->'create_lead'->>'pipeline_id')::uuid;
      v_stage := nullif(a->'create_lead'->>'stage_id','')::uuid;
      if v_stage is null then select id into v_stage from crm_stages where pipeline_id = v_pipe order by sort_order nulls last, created_at limit 1; end if;
      if not p_dry then
        insert into crm_leads (name, phone, pipeline_id, stage_id, origin_id)
        values (case when coalesce(ct.name,'') ~ '[[:alpha:]]' then btrim(ct.name) else ct.phone end, ct.phone, v_pipe, v_stage, nullif(a->'create_lead'->>'origin_id','')::uuid)
        returning id into v_lead;
        update crm_whatsapp_conversations set lead_id = v_lead where id = cv.id and lead_id is null;
      end if;
      v_new_lead := true;
      v_res := v_res || jsonb_build_object('lead_criado', true, 'pipeline_id', v_pipe, 'stage_id', v_stage);
    end if;

    -- 2) mover lead que já existia
    if not v_new_lead and v_lead is not null and coalesce((a->'move_stage'->>'enabled')::boolean, false) and nullif(a->'move_stage'->>'stage_id','') is not null then
      v_stage := (a->'move_stage'->>'stage_id')::uuid;
      select pipeline_id into v_pipe from crm_stages where id = v_stage;
      if not p_dry then update crm_leads set pipeline_id = v_pipe, stage_id = v_stage, stage_entered_at = now() where id = v_lead and stage_id is distinct from v_stage; end if;
      v_res := v_res || jsonb_build_object('movido_para', v_stage);
    end if;

    -- 3) responsável: fixo ou rodízio
    if coalesce(a->'assign'->>'mode','none') <> 'none' and jsonb_array_length(coalesce(a->'assign'->'staff_ids','[]'::jsonb)) > 0 then
      select owner_staff_id into v_owner from crm_leads where id = v_lead;
      if v_lead is null or v_owner is null or v_new_lead or not coalesce((a->'assign'->>'only_if_unowned')::boolean, true) then
        if a->'assign'->>'mode' = 'fixed' then
          select s.id into v_staff from onboarding_staff s where s.id = (a->'assign'->'staff_ids'->>0)::uuid and s.is_active;
        elsif p_dry then
          select r.staff_id into v_staff from (select (x)::uuid staff_id from jsonb_array_elements_text(a->'assign'->'staff_ids') x) r
            left join crm_automation_rr rr on rr.automation_id = au.id and rr.staff_id = r.staff_id
            join onboarding_staff s on s.id = r.staff_id and s.is_active
            order by rr.last_assigned_at asc nulls first limit 1;
        else
          v_staff := crm_automation_pick_staff(au.id, array(select (x)::uuid from jsonb_array_elements_text(a->'assign'->'staff_ids') x));
        end if;
        if v_staff is not null and not p_dry then
          if v_lead is not null then update crm_leads set owner_staff_id = v_staff where id = v_lead; end if;
          if coalesce((a->'assign'->>'assign_conversation')::boolean, true) then update crm_whatsapp_conversations set assigned_to = v_staff where id = cv.id; end if;
        end if;
        if v_staff is not null then v_res := v_res || jsonb_build_object('responsavel', (select name from onboarding_staff where id = v_staff)); end if;
      end if;
    end if;

    -- 4) etiquetas
    if v_lead is not null and not p_dry then
      for v_tag in select (x)::uuid from jsonb_array_elements_text(coalesce(a->'tag_ids','[]'::jsonb)) x loop
        insert into crm_lead_tags (lead_id, tag_id) values (v_lead, v_tag) on conflict do nothing;
      end loop;
    end if;
    if jsonb_array_length(coalesce(a->'tag_ids','[]'::jsonb)) > 0 then v_res := v_res || jsonb_build_object('etiquetas', jsonb_array_length(a->'tag_ids')); end if;

    -- 5) setor da conversa
    if nullif(a->>'sector_id','') is not null and not p_dry then update crm_whatsapp_conversations set sector_id = (a->>'sector_id')::uuid where id = cv.id; end if;

    if not p_dry then
      insert into crm_automation_runs (automation_id, conversation_id, lead_id, assigned_staff_id, result)
        values (au.id, cv.id, v_lead, v_staff, v_res) on conflict do nothing returning id into v_run;
      update crm_automations set run_count = run_count + 1, last_run_at = now() where id = au.id;
      -- 6) avisar o responsável no WhatsApp (a função confere o registro antes de enviar)
      if v_run is not null and v_staff is not null and coalesce((a->'notify'->>'enabled')::boolean, false) then
        perform net.http_post(url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/crm-automation-notify',
          headers := jsonb_build_object('Content-Type','application/json'), body := jsonb_build_object('run_id', v_run), timeout_milliseconds := 20000);
      end if;
      -- a conversa pode ter ganhado lead: relê pra próxima regra
      select * into cv from crm_whatsapp_conversations where id = p_conversation;
    end if;
    v_out := v_out || jsonb_build_array(v_res);
    if au.stop_after then exit; end if;
  end loop;
  return v_out;
end $function$
;
revoke all on function public.crm_run_wa_automations(uuid,text,boolean,boolean,uuid) from public, anon;
grant execute on function public.crm_run_wa_automations(uuid,text,boolean,boolean,uuid) to authenticated, service_role;

create or replace function public.crm_automation_backfill(p_automation uuid, p_days int default 7, p_dry boolean default true, p_trigger_agent boolean default true, p_conversations uuid[] default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare au record; cv record; v_txt text; v_last text; v_res jsonb; v_out jsonb := '[]'::jsonb; c jsonb; n int := 0;
begin
  if auth.uid() is not null and not crm_is_settings_admin() then raise exception 'sem permissão'; end if;
  select * into au from crm_automations where id = p_automation and is_active and trigger_type = 'wa_first_inbound';
  if not found then raise exception 'automação não encontrada ou desligada'; end if;
  c := au.conditions;
  p_days := least(greatest(coalesce(p_days,7),1),60);
  for cv in
    select cc.id, ct.name, ct.phone, cc.created_at from crm_whatsapp_conversations cc
    join crm_whatsapp_contacts ct on ct.id = cc.contact_id
    where cc.created_at > now() - make_interval(days => p_days)
      and (p_conversations is null or cc.id = any(p_conversations))
      and (jsonb_array_length(coalesce(c->'instance_ids','[]'::jsonb)) + jsonb_array_length(coalesce(c->'official_instance_ids','[]'::jsonb)) = 0
           or (cc.instance_id is not null and (c->'instance_ids') ? cc.instance_id::text)
           or (cc.official_instance_id is not null and (c->'official_instance_ids') ? cc.official_instance_id::text))
      and not exists (select 1 from crm_automation_runs r where r.automation_id = au.id and r.conversation_id = cc.id)
      and exists (select 1 from crm_whatsapp_messages m where m.conversation_id = cc.id and m.direction = 'inbound')
    order by cc.created_at limit 200
  loop
    select string_agg(coalesce(m.content,''), ' ') into v_txt from crm_whatsapp_messages m where m.conversation_id = cv.id and m.direction = 'inbound';
    v_res := crm_run_wa_automations(cv.id, coalesce(v_txt,''), p_dry, true, au.id);
    if jsonb_array_length(v_res) = 0 then continue; end if;
    n := n + 1;
    select m.direction into v_last from crm_whatsapp_messages m where m.conversation_id = cv.id order by m.created_at desc limit 1;
    if not p_dry and p_trigger_agent and v_last = 'inbound' then
      perform net.http_post(url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/crm-agent-respond',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('channel','whatsapp','conversation_id', cv.id), timeout_milliseconds := 60000);
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('conversation_id', cv.id, 'nome', cv.name, 'telefone', cv.phone,
      'chegou_em', cv.created_at, 'aguardando_resposta', v_last = 'inbound',
      'ultima', (select left(m.content,120) from crm_whatsapp_messages m where m.conversation_id = cv.id and m.direction='inbound' order by m.created_at desc limit 1),
      'resultado', v_res->0));
  end loop;
  return jsonb_build_object('total', n, 'dry', p_dry, 'itens', v_out);
end $f$;
revoke all on function public.crm_automation_backfill(uuid,int,boolean,boolean,uuid[]) from public, anon;
grant execute on function public.crm_automation_backfill(uuid,int,boolean,boolean,uuid[]) to authenticated, service_role;
commit;
