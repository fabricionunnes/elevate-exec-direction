-- Outros telefones no lead (crm_leads.extra_phones). Pedido do Fabrício em 07/10/2026:
-- em vez de excluir o lead duplicado, mesclar e ficar com um contato só com os dois números.
-- 1) coluna + campo nativo na aba Contato; 2) mesclagem guarda o telefone do duplicado;
-- 3) conversa nova casa também pelos outros telefones; 4) formulário da UNV Ads idem.
alter table public.crm_leads add column if not exists extra_phones text[] not null default '{}'::text[];

insert into public.crm_custom_fields (context, section, is_active, is_system, field_name, field_type, sort_order, field_label, is_required)
select 'contact', 'Informações Gerais', true, true, 'extra_phones', 'text', 5, 'Outros telefones', false
 where not exists (select 1 from public.crm_custom_fields where field_name = 'extra_phones');

CREATE OR REPLACE FUNCTION public.crm_lead_merge_one(p_primary uuid, p_secondary uuid, p_staff uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p crm_leads; s crm_leads;
begin
  if p_primary is null or p_secondary is null or p_primary = p_secondary then return; end if;
  select * into p from crm_leads where id = p_primary for update;
  select * into s from crm_leads where id = p_secondary for update;
  if p.id is null or s.id is null then return; end if;
  if p.tenant_id is distinct from s.tenant_id then
    raise exception 'Leads de contas diferentes não podem ser mesclados';
  end if;

  update crm_leads l set
    phone = coalesce(nullif(btrim(l.phone), ''), s.phone),
    -- o telefone do duplicado não se perde: vai pra lista de outros telefones (sem repetir o principal)
    extra_phones = (
      select coalesce(array_agg(distinct x order by x), '{}'::text[])
        from unnest(coalesce(l.extra_phones, '{}'::text[]) || coalesce(s.extra_phones, '{}'::text[]) || array[s.phone]) x
       where nullif(btrim(x), '') is not null
         and br_phone_key(x) is distinct from br_phone_key(coalesce(nullif(btrim(l.phone), ''), s.phone))
    ),
    email = coalesce(nullif(btrim(l.email), ''), s.email),
    company = coalesce(nullif(btrim(l.company), ''), s.company),
    document = coalesce(nullif(btrim(l.document), ''), s.document),
    cpf = coalesce(nullif(btrim(l.cpf), ''), s.cpf),
    role = coalesce(nullif(btrim(l.role), ''), s.role),
    city = coalesce(nullif(btrim(l.city), ''), s.city),
    state = coalesce(nullif(btrim(l.state), ''), s.state),
    segment = coalesce(nullif(btrim(l.segment), ''), s.segment),
    instagram = coalesce(nullif(btrim(l.instagram), ''), s.instagram),
    estimated_revenue = coalesce(nullif(btrim(l.estimated_revenue), ''), s.estimated_revenue),
    employee_count = coalesce(nullif(btrim(l.employee_count), ''), s.employee_count),
    main_pain = coalesce(nullif(btrim(l.main_pain), ''), s.main_pain),
    product_id = coalesce(l.product_id, s.product_id),
    owner_staff_id = coalesce(l.owner_staff_id, s.owner_staff_id),
    utm_source = coalesce(l.utm_source, s.utm_source),
    utm_medium = coalesce(l.utm_medium, s.utm_medium),
    utm_campaign = coalesce(l.utm_campaign, s.utm_campaign),
    utm_content = coalesce(l.utm_content, s.utm_content),
    utm_term = coalesce(l.utm_term, s.utm_term),
    notes = case
      when nullif(btrim(l.notes), '') is null then s.notes
      when nullif(btrim(s.notes), '') is null or btrim(s.notes) = btrim(l.notes) then l.notes
      else l.notes || E'\n---\n' || s.notes end,
    opportunity_value = case
      when coalesce(l.opportunity_value, 0) < coalesce(s.opportunity_value, 0) then s.opportunity_value
      else l.opportunity_value end,
    last_activity_at = case
      when l.last_activity_at is null then s.last_activity_at
      when s.last_activity_at is null then l.last_activity_at
      else greatest(l.last_activity_at, s.last_activity_at) end,
    updated_at = now()
  where l.id = p_primary;

  -- o que tem unicidade por lead: entra só o que o principal ainda não tem
  insert into crm_lead_tags (lead_id, tag_id)
    select p_primary, t.tag_id from crm_lead_tags t where t.lead_id = p_secondary
    on conflict do nothing;
  insert into crm_custom_field_values (lead_id, field_id, value)
    select p_primary, v.field_id, v.value from crm_custom_field_values v
    where v.lead_id = p_secondary and nullif(btrim(v.value), '') is not null
    on conflict do nothing;
  insert into crm_lead_list_items (list_id, lead_id, added_by, added_at)
    select i.list_id, p_primary, i.added_by, i.added_at from crm_lead_list_items i where i.lead_id = p_secondary
    on conflict do nothing;

  -- o que só aponta pro lead: muda de dono
  update crm_activities set lead_id = p_primary where lead_id = p_secondary;
  update crm_lead_history set lead_id = p_primary where lead_id = p_secondary;
  update crm_meeting_events set lead_id = p_primary where lead_id = p_secondary;
  update crm_lead_form_answers set lead_id = p_primary where lead_id = p_secondary;
  update crm_whatsapp_conversations set lead_id = p_primary where lead_id = p_secondary;
  update crm_whatsapp_contacts set lead_id = p_primary where lead_id = p_secondary;
  update instagram_conversations set lead_id = p_primary where lead_id = p_secondary;
  update crm_calls set lead_id = p_primary where lead_id = p_secondary;
  update crm_scheduled_calls set lead_id = p_primary where lead_id = p_secondary;
  update crm_voice_calls set lead_id = p_primary where lead_id = p_secondary;
  update crm_transcriptions set lead_id = p_primary where lead_id = p_secondary;
  update media_transcriptions set lead_id = p_primary where lead_id = p_secondary;
  update crm_attachments set lead_id = p_primary where lead_id = p_secondary;
  update crm_lead_files set lead_id = p_primary where lead_id = p_secondary;
  update crm_lead_payments set lead_id = p_primary where lead_id = p_secondary;
  update crm_sales set lead_id = p_primary where lead_id = p_secondary;
  update onboarding_projects set crm_lead_id = p_primary where crm_lead_id = p_secondary;
  update public_service_purchases set crm_lead_id = p_primary where crm_lead_id = p_secondary;
  update sales_scanner_submissions set lead_id = p_primary where lead_id = p_secondary;

  insert into crm_lead_history (lead_id, action, field_changed, old_value, new_value, notes, staff_id)
  values (p_primary, 'merge', 'lead', p_secondary::text, p_primary::text,
    'Lead duplicado mesclado neste: ' || coalesce(nullif(btrim(s.name), ''), 'sem nome')
      || case when s.phone is not null then ', ' || s.phone else '' end
      || case when s.email is not null then ', ' || s.email else '' end,
    p_staff);

  delete from crm_leads where id = p_secondary;
end $function$

;

create or replace function public.link_wa_conversation_lead()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_phone text; v_lead uuid;
begin
  if new.lead_id is not null or new.contact_id is null then return new; end if;
  select ct.phone into v_phone from crm_whatsapp_contacts ct where ct.id = new.contact_id;
  if coalesce(v_phone,'') = '' or v_phone like '%@g.us%' then return new; end if;
  if length(br_phone_key(v_phone)) <> 10 then return new; end if;
  -- casa pelo telefone principal OU por qualquer um dos outros telefones do lead
  select l.id into v_lead from crm_leads l
   where l.tenant_id is null
     and (br_phone_key(l.phone) = br_phone_key(v_phone)
          or exists (select 1 from unnest(coalesce(l.extra_phones, '{}'::text[])) x where br_phone_key(x) = br_phone_key(v_phone)))
   order by (br_phone_key(l.phone) = br_phone_key(v_phone)) desc, l.created_at desc limit 1;
  if v_lead is not null then new.lead_id := v_lead; end if;
  return new;
exception when others then return new;
end $function$;

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
      update crm_leads set extra_phones = array_append(coalesce(extra_phones, '{}'::text[]), v_ct.phone)
       where id = v_lead
         and not exists (select 1 from unnest(coalesce(extra_phones, '{}'::text[])) x where br_phone_key(x) = br_phone_key(v_ct.phone));
    end if;
  end if;
  return v_lead;
exception when others then return null;
end $fn$;

-- Bruno Delly Bangratz: o 2º número sai da observação e vai pro campo próprio
update public.crm_leads
   set extra_phones = '{554896502502}'::text[],
       notes = nullif(btrim(regexp_replace(coalesce(notes,''), E'\\n?WhatsApp alternativo \\(mensagem do formulário\\): 554896502502', '', 'g')), '')
 where id = '2307bd45-9c04-4d5b-93b1-b2501b34932a';
