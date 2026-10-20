-- Pontinho do Atendimento segue o filtro de número/canal salvo no Atendimento (Fabrício, 20/10:
-- "continua o verde sem ter mensagem não lida": a lista estava filtrada no número do Ricardo e o
-- pontinho contava Instagram). p_filtro: 'all' | 'evo:<id>' | 'off:<id>' | 'ig:<id>' (mesmo
-- formato de localStorage crm_inbox_instance_filter).
drop function if exists public.crm_inbox_nao_lidas();
create or replace function public.crm_inbox_nao_lidas(p_filtro text default 'all')
returns int language plpgsql stable security definer set search_path = public as $$
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
     where c.unread_count > 0 and c.merged_into is null and coalesce(c.status, 'open') <> 'closed'
       and not coalesce(i.is_personal, false)
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
end $$;
grant execute on function public.crm_inbox_nao_lidas(text) to authenticated;
