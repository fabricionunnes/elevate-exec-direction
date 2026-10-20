-- Pontinho verde do menu Atendimento (Fabrício, 20/10/2026): "só apareça se tiver mensagem sem
-- ler". Antes era fixo. Conta conversas com não lidas nos números que aparecem no Atendimento
-- (show_in_inbox), fora a instância pessoal, mais Instagram.
create or replace function public.crm_inbox_nao_lidas()
returns int language sql stable security definer set search_path = public as $$
  select (
    (select count(*) from crm_whatsapp_conversations c
       left join whatsapp_instances i on i.id = c.instance_id
       left join whatsapp_official_instances o on o.id = c.official_instance_id
      where c.unread_count > 0 and c.merged_into is null and coalesce(c.status, 'open') <> 'closed'
        and not coalesce(i.is_personal, false)
        and ((i.id is not null and coalesce(i.show_in_inbox, true)) or (o.id is not null and coalesce(o.show_in_inbox, true))))
    +
    (select count(*) from instagram_conversations c
       left join instagram_instances i on i.id = c.instance_id
      where c.unread_count > 0 and coalesce(c.status, 'open') <> 'closed' and coalesce(i.show_in_inbox, true))
  )::int
  where (select get_current_staff_id()) is not null
$$;
grant execute on function public.crm_inbox_nao_lidas() to authenticated;
