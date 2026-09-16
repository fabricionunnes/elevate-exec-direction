-- Resultado comercial por disparo da API oficial: reuniões agendadas/realizadas, no-show e vendas.
-- Atribuição por último toque: o evento conta pro disparo mais recente que ENTREGOU/ACEITOU
-- mensagem pro lead antes do evento, dentro de 30 dias.
create or replace function public.official_campaign_outcomes(p_from timestamptz, p_to timestamptz)
returns table(campaign_id uuid, agendadas bigint, realizadas bigint, no_show bigint, vendas bigint, valor_vendas numeric)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active) then
    raise exception 'sem acesso ao CRM';
  end if;
  return query
  with toques as (
    select r.campaign_id cid, r.lead_id, r.sent_at
    from whatsapp_official_campaign_recipients r
    where r.lead_id is not null and r.sent_at is not null and r.status in ('sent','delivered','read')
  ), leads as (select distinct t.lead_id from toques t),
  eventos as (
    select e.lead_id, e.created_at quando,
      case when e.event_type = 'scheduled' then 'agendada'
           when e.event_type in ('realized','realized_out_of_icp') then 'realizada'
           else 'no_show' end tipo,
      null::numeric valor, e.id ref
    from crm_meeting_events e
    where e.event_type in ('scheduled','realized','realized_out_of_icp','no_show')
      and e.lead_id in (select lead_id from leads)
    union all
    -- reunião marcada como atividade (é assim que o agente de IA e a agenda registram)
    select a.lead_id, a.created_at, 'agendada', null::numeric, a.id
    from crm_activities a
    where a.type = 'meeting' and a.lead_id in (select lead_id from leads)
    union all
    select a.lead_id, coalesce(a.completed_at, a.updated_at, a.scheduled_at),
      case when a.status = 'completed' then 'realizada' else 'no_show' end, null::numeric, a.id
    from crm_activities a
    where a.type = 'meeting' and a.status in ('completed','no_show') and a.lead_id in (select lead_id from leads)
    union all
    select s.lead_id, s.created_at, 'venda', coalesce(nullif(s.revenue_value,0), s.billing_value, 0), s.id
    from crm_sales s where s.lead_id in (select lead_id from leads)
  ), atrib as (
    select ev.*, (select t.cid from toques t
                  where t.lead_id = ev.lead_id and t.sent_at <= ev.quando and t.sent_at >= ev.quando - interval '30 days'
                  order by t.sent_at desc limit 1) cid
    from eventos ev
  )
  select c.id,
    count(distinct a.lead_id) filter (where a.tipo = 'agendada'),
    count(distinct a.lead_id) filter (where a.tipo = 'realizada'),
    count(distinct a.lead_id) filter (where a.tipo = 'no_show'),
    count(distinct a.ref) filter (where a.tipo = 'venda'),
    coalesce(sum(a.valor) filter (where a.tipo = 'venda'), 0)
  from whatsapp_official_campaigns c
  left join atrib a on a.cid = c.id
  where c.created_at >= p_from and c.created_at < p_to
  group by c.id;
end $$;
grant execute on function public.official_campaign_outcomes(timestamptz, timestamptz) to authenticated;
notify pgrst, 'reload schema';
