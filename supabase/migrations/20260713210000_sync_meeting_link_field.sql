-- Sincroniza o campo customizado "Link da Reunião" (deal) com o link da
-- próxima reunião ATIVA do lead. Cobre agendar (insert), reagendar (update
-- do link/data) e cancelar (status cancelled → cai pra próxima ou limpa).
create or replace function sync_meeting_link_field()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_lead uuid := coalesce(new.lead_id, old.lead_id);
  v_field uuid;
  v_link text;
begin
  if coalesce(new.type, old.type) is distinct from 'meeting' then return coalesce(new, old); end if;
  if v_lead is null then return coalesce(new, old); end if;

  select id into v_field from crm_custom_fields
  where context = 'deal' and field_name = 'meeting_link' limit 1;
  if v_field is null then return coalesce(new, old); end if;

  -- próxima reunião ativa (futura, não cancelada) com link; se não houver
  -- futura, pega a mais recente ativa com link
  select meeting_link into v_link
  from crm_activities
  where lead_id = v_lead and type = 'meeting'
    and coalesce(status, '') not in ('cancelled', 'canceled')
    and meeting_link is not null and trim(meeting_link) <> ''
  order by (scheduled_at >= now()) desc, scheduled_at asc
  limit 1;

  if v_link is null then
    -- nenhuma reunião ativa com link → limpa o campo
    delete from crm_custom_field_values where lead_id = v_lead and field_id = v_field;
  else
    insert into crm_custom_field_values (lead_id, field_id, value, updated_at)
    values (v_lead, v_field, v_link, now())
    on conflict (lead_id, field_id)
    do update set value = excluded.value, updated_at = now();
  end if;

  return coalesce(new, old);
end;
$$;

-- unique pra o upsert funcionar (se ainda não existir)
create unique index if not exists uq_cfv_lead_field
  on crm_custom_field_values (lead_id, field_id);

drop trigger if exists trg_sync_meeting_link on crm_activities;
create trigger trg_sync_meeting_link
  after insert or update or delete on crm_activities
  for each row
  execute function sync_meeting_link_field();
