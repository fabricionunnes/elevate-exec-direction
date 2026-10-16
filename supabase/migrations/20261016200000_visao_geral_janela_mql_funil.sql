-- Visão geral: a migration do filtro por funil (20261016190000) recriou a janela a partir de uma cópia
-- anterior aos cards MQL/SQL e eles sumiram. Aqui a janela com as duas coisas (16/10/2026).
CREATE OR REPLACE FUNCTION public.crm_visao_geral_janela(p_from timestamp with time zone, p_to timestamp with time zone, p_origin uuid, p_campaign text, p_product text, p_staff uuid, p_ids uuid[], p_pipeline uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with leads as (
    select l.id, l.opportunity_value::numeric valor,
           (l.meta_campaign_id is not null or l.meta_lead_id is not null or l.fbclid is not null or l.utm_source is not null
             or coalesce(o.name, '') ~* 'tr[aá]fego' or coalesce(g.name, '') ~* 'tr[aá]fego') pago
      from crm_leads l
      left join crm_stages s on s.id = l.stage_id
      left join crm_origins o on o.id = l.origin_id
      left join crm_origin_groups g on g.id = o.group_id
     where l.tenant_id is null and l.created_at >= p_from and l.created_at < p_to
       and coalesce(s.exclude_from_lead_count, false) = false
       and (p_origin is null or l.origin_id = p_origin) and (p_pipeline is null or l.pipeline_id = p_pipeline)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
       and (p_ids is null or l.owner_staff_id = any(p_ids) or l.sdr_staff_id = any(p_ids) or l.closer_staff_id = any(p_ids))
  ),
  vendas as (
    select s.id, coalesce(s.revenue_value, 0)::numeric receita,
           (l.meta_campaign_id is not null or l.meta_lead_id is not null or l.fbclid is not null or l.utm_source is not null
             or coalesce(o.name, '') ~* 'tr[aá]fego' or coalesce(g.name, '') ~* 'tr[aá]fego') pago
      from crm_sales s
      left join crm_leads l on l.id = s.lead_id
      left join crm_origins o on o.id = l.origin_id
      left join crm_origin_groups g on g.id = o.group_id
      left join crm_pipelines p on p.id = s.pipeline_id
     where s.sale_date >= (p_from at time zone 'America/Sao_Paulo')::date
       and s.sale_date <= ((p_to - interval '1 second') at time zone 'America/Sao_Paulo')::date
       and coalesce(p.name, '') !~* 'evento|mans[ãa]o|palestra'
       and (p_origin is null or l.origin_id = p_origin) and (p_pipeline is null or l.pipeline_id = p_pipeline)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or s.product_name = p_product)
       and (p_staff is null or s.closer_staff_id = p_staff or s.sdr_staff_id = p_staff)
       and (p_ids is null or s.closer_staff_id = any(p_ids) or s.sdr_staff_id = any(p_ids))
  ),
  reunioes as (
    select distinct on (e.lead_id, e.event_type, date_trunc('minute', e.event_date)) e.id, e.event_type
      from crm_meeting_events e
      left join crm_leads l on l.id = e.lead_id
     where e.event_date >= p_from and e.event_date < p_to
       and e.event_type in ('scheduled', 'realized', 'no_show')
       and (p_origin is null or l.origin_id = p_origin) and (p_pipeline is null or l.pipeline_id = p_pipeline)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or e.credited_staff_id = p_staff or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
       and (p_ids is null or e.credited_staff_id = any(p_ids) or l.owner_staff_id = any(p_ids) or l.sdr_staff_id = any(p_ids) or l.closer_staff_id = any(p_ids))
  )
  select jsonb_build_object(
    'receita', (select coalesce(sum(receita), 0) from vendas),
    'receita_pagos', (select coalesce(sum(receita) filter (where pago), 0) from vendas),
    'vendas', (select count(*) from vendas),
    'leads', (select count(*) from leads),
    'leads_pagos', (select count(*) filter (where pago) from leads),
    -- MQL: lead do período que mostrou interesse ou foi qualificado (respondeu, avançou da etapa de
    -- entrada ou tem reunião). SQL: lead do período aceito pela venda (reunião agendada). 16/10/2026.
    'mql', (select count(*) from leads x join crm_leads l on l.id = x.id
             where exists (select 1 from crm_whatsapp_conversations cv join crm_whatsapp_messages m on m.conversation_id = cv.id
                            where cv.lead_id = l.id and m.direction = 'inbound')
                or exists (select 1 from instagram_conversations cv join instagram_messages m on m.conversation_id = cv.id
                            where cv.lead_id = l.id and m.direction = 'inbound')
                or exists (select 1 from crm_stages s join crm_stages s0 on s0.pipeline_id = s.pipeline_id
                            where s.id = l.stage_id group by s.sort_order having s.sort_order > min(s0.sort_order))
                or exists (select 1 from crm_meeting_events e where e.lead_id = l.id)
                or exists (select 1 from crm_activities a where a.lead_id = l.id and a.type = 'meeting')),
    'sql', (select count(*) from leads x join crm_leads l on l.id = x.id
             where exists (select 1 from crm_meeting_events e where e.lead_id = l.id and e.event_type in ('scheduled','realized'))
                or exists (select 1 from crm_activities a where a.lead_id = l.id and a.type = 'meeting')),
    'agendados', (select count(*) filter (where event_type = 'scheduled') from reunioes),
    'realizados', (select count(*) filter (where event_type = 'realized') from reunioes),
    'no_show', (select count(*) filter (where event_type = 'no_show') from reunioes),
    'ligacoes', (select count(*) from crm_calls c where c.tenant_id is null and c.created_at >= p_from and c.created_at < p_to and (p_staff is null or c.agent_staff_id = p_staff) and (p_ids is null or c.agent_staff_id = any(p_ids))),
    'msgs_wa', (select count(*) from crm_whatsapp_messages m where m.direction = 'inbound' and m.created_at >= p_from and m.created_at < p_to
                  and (p_ids is null or exists (select 1 from crm_whatsapp_conversations cv where cv.id = m.conversation_id and cv.assigned_to = any(p_ids)))),
    'msgs_ig', (select count(*) from instagram_messages m where m.direction = 'inbound' and coalesce(m.timestamp, m.created_at) >= p_from and coalesce(m.timestamp, m.created_at) < p_to
                  and (p_ids is null or exists (select 1 from instagram_conversations cv where cv.id = m.conversation_id and cv.assigned_to = any(p_ids))))
  );
$function$;
