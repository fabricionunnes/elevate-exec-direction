-- Pessoa que não recebe NENHUMA notificação do sistema (sino e avisos de fluxo), mesmo sendo
-- admin (Fabrício, 25/10/2026: "a Carol está recebendo notificações de lead parado, não precisa
-- receber nenhum tipo de notificação").
alter table public.onboarding_staff add column if not exists sem_notificacoes boolean not null default false;

-- 1) fluxos do CRM: "gestores" deixa de incluir quem está sem notificações
create or replace function public.crm_flow_people(_tenant uuid, _owner uuid, _cfg jsonb, _flow uuid, _node text, _peek boolean DEFAULT false)
 returns uuid[]
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _mode text := coalesce(nullif(_cfg->>'assignee_mode', ''), nullif(_cfg->>'to', ''), 'owner');
        _ids uuid[]; _pool uuid[]; _last uuid; _pos int;
begin
  if _mode = 'owner' then
    return case when _owner is null or not exists (select 1 from onboarding_staff where id = _owner and is_active)
                then '{}'::uuid[] else array[_owner] end;
  end if;
  if _mode = 'managers' then
    select coalesce(array_agg(id order by name), '{}') into _ids from onboarding_staff
     where is_active and tenant_id is not distinct from _tenant and role in ('master', 'admin', 'head_comercial')
       and not sem_notificacoes;
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

-- 2) sino: notificação pra quem está sem notificações nem é gravada
create or replace function public.trg_sem_notificacoes()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if NEW.staff_id is not null and exists (select 1 from onboarding_staff where id = NEW.staff_id and sem_notificacoes) then
    return null;
  end if;
  return NEW;
end $$;
drop trigger if exists aa_sem_notificacoes on public.onboarding_notifications;
create trigger aa_sem_notificacoes before insert on public.onboarding_notifications
  for each row execute function public.trg_sem_notificacoes();

update public.onboarding_staff set sem_notificacoes = true where id = '3690c1d4-ec62-47be-becf-2c850bbbbd79'; -- Carol Souza
-- some o que já está no sino dela
update public.onboarding_notifications set is_read = true where staff_id = '3690c1d4-ec62-47be-becf-2c850bbbbd79' and not is_read;
