-- Avisos de gestor vão SÓ pro Fabrício (master). Head comercial, se existir, recebe só os de lead
-- chegando (Fabrício, 25/10/2026: "os avisos é pra vir só pra mim mesmo, e se tiver head
-- comercial, os de lead chegando"). Avisos pessoais (tarefa/reunião do próprio responsável) seguem.

-- 1) fluxos: "gestores" = master; + head comercial quando o fluxo é de lead chegando
create or replace function public.crm_flow_people(_tenant uuid, _owner uuid, _cfg jsonb, _flow uuid, _node text, _peek boolean DEFAULT false)
 returns uuid[]
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _mode text := coalesce(nullif(_cfg->>'assignee_mode', ''), nullif(_cfg->>'to', ''), 'owner');
        _ids uuid[]; _pool uuid[]; _last uuid; _pos int; _lead_chegando boolean;
begin
  if _mode = 'owner' then
    return case when _owner is null or not exists (select 1 from onboarding_staff where id = _owner and is_active)
                then '{}'::uuid[] else array[_owner] end;
  end if;
  if _mode = 'managers' then
    select coalesce(trigger_type, '') in ('lead_created') into _lead_chegando from crm_flows where id = _flow;
    select coalesce(array_agg(id order by name), '{}') into _ids from onboarding_staff
     where is_active and tenant_id is not distinct from _tenant and not sem_notificacoes
       and (role = 'master' or (role = 'head_comercial' and coalesce(_lead_chegando, false)));
    return _ids;
  end if;
  select coalesce(array_agg(x::uuid), '{}') into _ids
    from jsonb_array_elements_text(coalesce(_cfg->'staff_ids', '[]'::jsonb)) x;
  select coalesce(array_agg(s.id order by array_position(_ids, s.id)), '{}') into _pool
    from onboarding_staff s where s.id = any(_ids) and s.is_active and s.tenant_id is not distinct from _tenant;
  if array_length(_pool, 1) is null then return '{}'::uuid[]; end if;
  if _mode = 'round_robin' then
    select last_staff_id into _last from crm_flow_rr where flow_id = _flow and node_id = _node;
    _pos := coalesce(array_position(_pool, _last), 0) + 1;
    if _pos > array_length(_pool, 1) then _pos := 1; end if;
    if not _peek then
      insert into crm_flow_rr (flow_id, node_id, last_staff_id) values (_flow, _node, _pool[_pos])
      on conflict (flow_id, node_id) do update set last_staff_id = excluded.last_staff_id;
    end if;
    return array[_pool[_pos]];
  end if;
  return _pool;  -- fixed
end $function$;

-- 2) empresa cadastrada sem consultor: só o master (antes admin + cs)
create or replace function public.notify_company_without_consultant()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_staff_member record;
begin
  if NEW.consultant_id is null then
    for v_staff_member in
      select id from public.onboarding_staff
       where is_active and role = 'master' and not sem_notificacoes
         and tenant_id is not distinct from NEW.tenant_id
    loop
      insert into public.onboarding_notifications (staff_id, type, title, message, reference_id, reference_type)
      values (v_staff_member.id, 'company_no_consultant', '⚠️ Nova empresa sem consultor: ' || NEW.name,
              'A empresa "' || NEW.name || '" foi cadastrada sem um consultor atribuído. Por favor, atribua um consultor.',
              NEW.id, 'company');
    end loop;
  end if;
  return NEW;
end $function$;

-- 3) aviso de lead chegando no WhatsApp (lista crm_lead_notification_numbers, lida pelas funções de
--    formulário/lead externo): head comercial ativo com celular entra e sai sozinho
alter table public.crm_lead_notification_numbers add column if not exists staff_id uuid references public.onboarding_staff(id) on delete set null;
create or replace function public.sync_head_comercial_aviso_lead()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_fone text := regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g');
begin
  if NEW.tenant_id is null and NEW.role = 'head_comercial' and NEW.is_active and not NEW.sem_notificacoes and length(v_fone) >= 10 then
    if not v_fone like '55%' or length(v_fone) <= 11 then v_fone := '55' || v_fone; end if;
    if exists (select 1 from crm_lead_notification_numbers where staff_id = NEW.id) then
      update crm_lead_notification_numbers set phone = v_fone, name = NEW.name || ' (head comercial)', is_active = true where staff_id = NEW.id;
    else
      insert into crm_lead_notification_numbers (phone, name, is_active, staff_id) values (v_fone, NEW.name || ' (head comercial)', true, NEW.id);
    end if;
  else
    update crm_lead_notification_numbers set is_active = false where staff_id = NEW.id and is_active;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_sync_head_comercial_aviso_lead on public.onboarding_staff;
create trigger trg_sync_head_comercial_aviso_lead after insert or update of role, is_active, phone, sem_notificacoes on public.onboarding_staff
  for each row execute function public.sync_head_comercial_aviso_lead();
