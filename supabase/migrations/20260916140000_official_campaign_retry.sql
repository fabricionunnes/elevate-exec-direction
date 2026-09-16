-- Reenvio das falhas de um disparo da API oficial: cria um disparo novo (mesmo template,
-- variáveis, etapa, agente e etiquetas) só com os destinatários que falharam nos códigos escolhidos.
create or replace function public.official_campaign_retry(p_campaign uuid, p_codes text[])
returns json language plpgsql security definer set search_path to 'public' as $$
declare st record; c record; v_new uuid; v_n int;
begin
  select s.id, s.name into st from onboarding_staff s where s.user_id = auth.uid() and s.is_active limit 1;
  if st.id is null then raise exception 'sem acesso ao CRM'; end if;
  select * into c from whatsapp_official_campaigns where id = p_campaign;
  if c.id is null then raise exception 'Disparo não encontrado'; end if;
  if c.status = 'sending' then raise exception 'Esse disparo ainda está enviando. Pause ou espere terminar.'; end if;

  create temp table _alvo on commit drop as
  select distinct on (regexp_replace(r.phone, '\D', '', 'g')) r.lead_id, r.lead_name, r.phone
  from whatsapp_official_campaign_recipients r
  where r.campaign_id = p_campaign
    and r.status in ('failed', 'error')
    and coalesce(r.phone, '') <> ''
    and coalesce(substring(coalesce(r.error_text, '') from '^\d+'), 'outros') = any(p_codes)
    -- já recebeu esse template (em qualquer disparo) nos últimos 7 dias: não manda de novo
    and not exists (
      select 1 from whatsapp_official_campaign_recipients o
      join whatsapp_official_campaigns oc on oc.id = o.campaign_id
      where oc.template_name = c.template_name
        and regexp_replace(o.phone, '\D', '', 'g') = regexp_replace(r.phone, '\D', '', 'g')
        and o.status in ('sent', 'delivered', 'read')
        and o.sent_at > now() - interval '7 days')
  order by regexp_replace(r.phone, '\D', '', 'g'), r.created_at desc;

  select count(*) into v_n from _alvo;
  if v_n = 0 then raise exception 'Nenhuma falha pra reenviar com esses motivos'; end if;

  insert into whatsapp_official_campaigns (official_instance_id, template_name, template_language, template_category,
    body_preview, variables, template_body, created_by_staff_id, created_by_name, source, move_mode, move_stage_id,
    tag_name, agent_id, extra_tag_ids, total, status, notes)
  values (c.official_instance_id, c.template_name, c.template_language, c.template_category,
    c.body_preview, c.variables, c.template_body, st.id, st.name, 'reenvio', c.move_mode, c.move_stage_id,
    c.tag_name, c.agent_id, coalesce(c.extra_tag_ids, '{}'), v_n, 'sending',
    'Reenvio das falhas do disparo de ' || to_char(c.created_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'))
  returning id into v_new;

  insert into whatsapp_official_campaign_recipients (campaign_id, lead_id, lead_name, phone, status)
  select v_new, a.lead_id, a.lead_name, a.phone, 'pending' from _alvo a;

  return json_build_object('campaign_id', v_new, 'total', v_n);
end $$;
grant execute on function public.official_campaign_retry(uuid, text[]) to authenticated;
notify pgrst, 'reload schema';
