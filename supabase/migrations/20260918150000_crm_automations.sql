-- 18/09/2026 — Automações do CRM (pedido do Fabrício): regras configuráveis do tipo
-- "lead que chegar pela instância X vai pro funil Y, com rodízio entre A, B e C, etiqueta Z".
-- Motor no banco: roda na PRIMEIRA mensagem recebida de uma conversa de WhatsApp (Evolution e API oficial).
create table if not exists public.crm_automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default false,
  trigger_type text not null default 'wa_first_inbound',
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  position int not null default 0,
  stop_after boolean not null default true,       -- bateu nesta regra, não avalia as próximas
  activated_at timestamptz,                        -- "só conversas novas" conta a partir daqui
  run_count int not null default 0,
  last_run_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.crm_automation_rr (
  automation_id uuid not null references public.crm_automations(id) on delete cascade,
  staff_id uuid not null references public.onboarding_staff(id) on delete cascade,
  last_assigned_at timestamptz,
  assigned_count int not null default 0,
  primary key (automation_id, staff_id)
);
create table if not exists public.crm_automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.crm_automations(id) on delete cascade,
  conversation_id uuid,
  lead_id uuid,
  assigned_staff_id uuid,
  result jsonb not null default '{}'::jsonb,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists crm_automation_runs_once on public.crm_automation_runs (automation_id, conversation_id);
create index if not exists crm_automation_runs_recent on public.crm_automation_runs (automation_id, created_at desc);

alter table public.crm_automations enable row level security;
alter table public.crm_automation_rr enable row level security;
alter table public.crm_automation_runs enable row level security;
revoke all on public.crm_automations, public.crm_automation_rr, public.crm_automation_runs from anon;
grant select, insert, update, delete on public.crm_automations, public.crm_automation_rr, public.crm_automation_runs to authenticated, service_role;

-- leitura: equipe do CRM; escrita: master/admin (mesma regra da aba Distribuição)
create or replace function public.crm_is_settings_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from onboarding_staff where user_id = auth.uid() and is_active and role in ('master','admin'));
$$;
drop policy if exists crm_automations_read on public.crm_automations;
create policy crm_automations_read on public.crm_automations for select to authenticated using (get_current_staff_id() is not null);
drop policy if exists crm_automations_write on public.crm_automations;
create policy crm_automations_write on public.crm_automations for all to authenticated using (crm_is_settings_admin()) with check (crm_is_settings_admin());
drop policy if exists crm_automation_rr_read on public.crm_automation_rr;
create policy crm_automation_rr_read on public.crm_automation_rr for select to authenticated using (get_current_staff_id() is not null);
drop policy if exists crm_automation_runs_read on public.crm_automation_runs;
create policy crm_automation_runs_read on public.crm_automation_runs for select to authenticated using (get_current_staff_id() is not null);

-- marca quando a regra foi ligada (base do "só conversas novas")
create or replace function public.crm_automations_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.is_active and (tg_op = 'INSERT' or not old.is_active or new.activated_at is null) then new.activated_at := now(); end if;
  return new;
end $$;
drop trigger if exists crm_automations_touch on public.crm_automations;
create trigger crm_automations_touch before insert or update on public.crm_automations for each row execute function public.crm_automations_touch();

-- rodízio: quem recebeu há mais tempo; só gente ativa; à prova de corrida
create or replace function public.crm_automation_pick_staff(p_automation uuid, p_staff uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if p_staff is null or array_length(p_staff, 1) is null then return null; end if;
  insert into crm_automation_rr (automation_id, staff_id)
    select p_automation, s.id from onboarding_staff s where s.id = any(p_staff) and s.is_active
    on conflict do nothing;
  select r.staff_id into v from crm_automation_rr r join onboarding_staff s on s.id = r.staff_id and s.is_active
   where r.automation_id = p_automation and r.staff_id = any(p_staff)
   order by r.last_assigned_at asc nulls first, r.assigned_count asc
   limit 1 for update of r skip locked;
  if v is not null then
    update crm_automation_rr set last_assigned_at = clock_timestamp(), assigned_count = assigned_count + 1 where automation_id = p_automation and staff_id = v;
  end if;
  return v;
end $$;

-- executa as regras pra uma conversa. p_dry = só diz o que faria (usado no "Testar" da tela).
create or replace function public.crm_run_wa_automations(p_conversation uuid, p_text text default '', p_dry boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cv record; ct record; au record; v_lead uuid; v_owner uuid; v_staff uuid; v_new_lead boolean;
  c jsonb; a jsonb; v_kw text; v_ok boolean; v_out jsonb := '[]'::jsonb; v_res jsonb; v_stage uuid; v_pipe uuid; v_tag uuid; v_run uuid;
begin
  select * into cv from crm_whatsapp_conversations where id = p_conversation;
  if not found then return v_out; end if;
  select name, phone into ct from crm_whatsapp_contacts where id = cv.contact_id;
  -- nunca em grupo / lista de transmissão
  if coalesce(ct.phone,'') = '' or ct.phone like '%@g.us%' or ct.phone like '%-%' or length(regexp_replace(ct.phone,'\D','','g')) > 15 then return v_out; end if;

  for au in select * from crm_automations where is_active and trigger_type = 'wa_first_inbound' order by position, created_at loop
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
    if coalesce((c->>'only_new_conversations')::boolean, true) and au.activated_at is not null and cv.created_at < au.activated_at - interval '2 minutes' then continue; end if;
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
end $$;
revoke all on function public.crm_run_wa_automations(uuid, text, boolean) from public;
grant execute on function public.crm_run_wa_automations(uuid, text, boolean) to authenticated, service_role;

-- gatilho: primeira linha de defesa é NÃO custar nada quando não há regra ligada, e NUNCA derrubar o webhook
create or replace function public.trg_crm_automation_on_wa_inbound() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.direction = 'inbound' and exists (select 1 from crm_automations where is_active and trigger_type = 'wa_first_inbound') then
    begin
      perform crm_run_wa_automations(NEW.conversation_id, coalesce(NEW.content,''), false);
    exception when others then raise warning 'crm automations falhou: %', sqlerrm;
    end;
  end if;
  return NEW;
end $$;
drop trigger if exists aa_crm_automation_on_wa_inbound on public.crm_whatsapp_messages;
create trigger aa_crm_automation_on_wa_inbound after insert on public.crm_whatsapp_messages for each row execute function public.trg_crm_automation_on_wa_inbound();

-- chaves pro histórico conseguir mostrar nome do lead e do responsável
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'crm_automation_runs_lead_id_fkey') then
    alter table public.crm_automation_runs add constraint crm_automation_runs_lead_id_fkey foreign key (lead_id) references public.crm_leads(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_automation_runs_assigned_staff_id_fkey') then
    alter table public.crm_automation_runs add constraint crm_automation_runs_assigned_staff_id_fkey foreign key (assigned_staff_id) references public.onboarding_staff(id) on delete set null;
  end if;
end $$;
notify pgrst, 'reload schema';
