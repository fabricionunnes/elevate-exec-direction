-- 16/11/2026, Fabrício: "tá falando que não tem mensagem não lida, mas o menu atendimento continua com uma
-- bolinha verde". A bolinha contava conversa oculta (grupo de promoção em crm_whatsapp_ignored_chats), que a
-- lista do Atendimento não mostra. Agora a contagem pula as ocultas.
create or replace function public.crm_inbox_nao_lidas(p_filtro text default 'all'::text)
 returns integer
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare v_tipo text; v_id uuid; v_wa int := 0; v_ig int := 0;
begin
  if (select get_current_staff_id()) is null then return 0; end if;
  if coalesce(p_filtro, 'all') <> 'all' and position(':' in p_filtro) > 0 then
    v_tipo := split_part(p_filtro, ':', 1);
    begin v_id := split_part(p_filtro, ':', 2)::uuid; exception when others then v_id := null; end;
  end if;
  if v_tipo is null or v_tipo in ('evo', 'off') then
    select count(*) into v_wa from crm_whatsapp_conversations c
      left join whatsapp_instances i on i.id = c.instance_id
      left join whatsapp_official_instances o on o.id = c.official_instance_id
      left join crm_whatsapp_contacts ct on ct.id = c.contact_id
     where c.unread_count > 0 and c.merged_into is null and coalesce(c.status, 'open') <> 'closed'
       and not coalesce(i.is_personal, false)
       and not coalesce(c.pessoal, false)
       and not exists (select 1 from crm_whatsapp_ignored_chats g where g.phone = ct.phone)
       and ((i.id is not null and coalesce(i.show_in_inbox, true)) or (o.id is not null and coalesce(o.show_in_inbox, true)))
       and (v_tipo is null
            or (v_tipo = 'evo' and c.instance_id = v_id)
            or (v_tipo = 'off' and c.official_instance_id = v_id and c.instance_id is null));
  end if;
  if v_tipo is null or v_tipo = 'ig' then
    select count(*) into v_ig from instagram_conversations c
      left join instagram_instances i on i.id = c.instance_id
     where c.unread_count > 0 and coalesce(c.status, 'open') <> 'closed' and coalesce(i.show_in_inbox, true)
       and (v_tipo is null or c.instance_id = v_id);
  end if;
  return v_wa + v_ig;
end $function$;
