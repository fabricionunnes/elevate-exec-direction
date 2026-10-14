-- Número reserva (14/10/2026, Fabrício: "quando um não tiver ativo pode jogar no outro").
-- Já aplicado em produção pela Management API. Usado pela crm-agent-respond v147.
alter table public.whatsapp_instances add column if not exists failover_instance_id uuid references public.whatsapp_instances(id) on delete set null;
comment on column public.whatsapp_instances.failover_instance_id is 'Número reserva: quando este número cai, os agentes dele atendem as conversas novas do reserva (crm-agent-respond, 14/10/2026).';

create or replace function public.wa_instance_down_since(_id uuid)
 returns timestamptz language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(
    (select i.updated_at from public.whatsapp_instances i where i.id = _id and i.status <> 'connected'),
    (select a.last_event_at
       from public.wa_instance_silence_alerts a
      where a.instance_id = _id
        and not exists (
          select 1 from public.crm_whatsapp_messages m
            join public.crm_whatsapp_conversations cv on cv.id = m.conversation_id
           where cv.instance_id = _id and m.direction = 'inbound' and m.created_at > a.last_event_at)
      order by a.last_event_at desc limit 1)
  );
$function$;
revoke all on function public.wa_instance_down_since(uuid) from public, anon, authenticated;
grant execute on function public.wa_instance_down_since(uuid) to service_role;

update public.whatsapp_instances r set failover_instance_id = f.id
  from public.whatsapp_instances f
 where (r.instance_name, f.instance_name) in (('ricardo-santos','fabricionunnes'), ('fabricionunnes','ricardo-santos'));
