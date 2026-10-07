-- Mensagem do formulário da UNV Ads casa com o lead do Tráfego Pago antes das automações (caso Bruno, 06/10/2026)

-- Casa a conversa com o lead que o formulário de diagnóstico da UNV Ads já criou, lendo
-- e-mail e telefone do texto da mensagem. Se não achar, cria o lead direto no Tráfego Pago
-- (funil do formulário), nunca no Funil SE. Devolve o lead ou null quando a mensagem não é
-- do formulário. p_apply=false só consulta (pra testar).
create or replace function public.crm_wa_lead_from_form_text(p_conversation uuid, p_text text, p_apply boolean default true)
returns uuid language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_email text; v_tel text; v_nome text; v_lead uuid; v_ct record; v_cv record;
  v_pipe uuid; v_stage uuid; v_alt text;
begin
  if p_text is null or p_text !~* 'acabei de preencher o diagn[óo]stico' then return null; end if;
  v_email := lower(btrim(substring(p_text from '(?i)e-?mail:[ \t]*([^\s]+)')));
  v_tel := regexp_replace(coalesce(substring(p_text from '(?i)whatsapp:[ \t]*([0-9()+ .-]{8,})'), ''), '\D', '', 'g');
  v_nome := btrim(substring(p_text from '(?i)nome:[ \t]*([^\n]+)'));
  select * into v_cv from crm_whatsapp_conversations where id = p_conversation;
  if not found then return null; end if;
  select phone, name into v_ct from crm_whatsapp_contacts where id = v_cv.contact_id;

  select l.id into v_lead from crm_leads l
   where l.tenant_id is null and l.created_at >= now() - interval '30 days'
     and ((v_email <> '' and lower(l.email) = v_email)
          or (length(br_phone_key(v_tel)) = 10 and br_phone_key(l.phone) = br_phone_key(v_tel)))
   order by (l.pipeline_id = '650ee7b4-d726-4b91-bc4f-138792747cdf'::uuid) desc, l.created_at desc limit 1;

  if v_lead is null then
    -- formulário sem lead (submit falhou?): cria no Tráfego Pago mesmo
    v_pipe := '650ee7b4-d726-4b91-bc4f-138792747cdf'::uuid;
    select id into v_stage from crm_stages where pipeline_id = v_pipe order by sort_order nulls last, created_at limit 1;
    if not p_apply then return null; end if;
    insert into crm_leads (name, phone, email, pipeline_id, stage_id, notes)
    values (coalesce(nullif(v_nome,''), v_ct.name, v_ct.phone), coalesce(nullif(v_tel,''), v_ct.phone), nullif(v_email,''), v_pipe, v_stage,
            'Criado pela mensagem do formulário de diagnóstico da UNV Ads (lead do formulário não encontrado).')
    returning id into v_lead;
  end if;

  if p_apply then
    update crm_whatsapp_conversations set lead_id = v_lead where id = p_conversation and lead_id is null;
    -- a pessoa escreveu de um número diferente do que digitou no formulário: anota no lead
    if length(br_phone_key(v_ct.phone)) = 10 and br_phone_key(v_ct.phone) <> br_phone_key((select phone from crm_leads where id = v_lead)) then
      v_alt := 'WhatsApp alternativo (mensagem do formulário): ' || v_ct.phone;
      update crm_leads set notes = case when coalesce(notes,'') = '' then v_alt else notes || E'\n' || v_alt end
       where id = v_lead and coalesce(notes,'') not like '%' || v_ct.phone || '%';
    end if;
  end if;
  return v_lead;
exception when others then return null;
end $fn$;

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

  -- Mensagem do formulário de diagnóstico da UNV Ads (wa.me com texto pronto): o lead já
  -- existe no Tráfego Pago, criado pelo submit-pipeline-form segundos antes. Quando a pessoa
  -- clica de um celular com outro número (caso Bruno, 06/10/2026), o casamento por telefone
  -- falha e a regra "Leads Funil SE" criava um lead duplicado no funil errado. Aqui casa pelo
  -- e-mail/telefone escritos no texto antes de qualquer regra rodar.
  if cv.lead_id is null and not p_dry then
    v_lead := crm_wa_lead_from_form_text(cv.id, p_text, true);
    if v_lead is not null then
      select * into cv from crm_whatsapp_conversations where id = p_conversation;
      v_out := v_out || jsonb_build_array(jsonb_build_object('automation', 'formulário UNV Ads', 'lead_casado', v_lead));
    end if;
  end if;

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
