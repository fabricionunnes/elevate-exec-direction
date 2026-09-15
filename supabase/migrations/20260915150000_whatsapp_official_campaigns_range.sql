create or replace function public.official_campaigns_range(p_from timestamptz, p_to timestamptz)
returns table(id uuid, created_at timestamptz, finished_at timestamptz, status text, template_name text, template_category text,
  created_by_name text, source text, notes text, official_instance_id uuid,
  total bigint, skipped bigint, send_errors bigint, accepted bigint, delivered bigint, read bigint, failed bigint,
  billable bigint, responded bigint, opted_out bigint)
language sql stable security definer set search_path = public as $$
  with rr as (
    select r.campaign_id, r.billable,
      public.official_recipient_status(r.status, msg.status) st,
      rep.first_at, rep.opt_out
    from whatsapp_official_campaign_recipients r
    join whatsapp_official_campaigns c0 on c0.id = r.campaign_id and c0.created_at >= p_from and c0.created_at < p_to
    left join crm_whatsapp_messages msg on msg.id = r.message_id
    left join lateral (
      select min(m.created_at) first_at, bool_or(m.content ilike '%parar de receber%') opt_out
      from crm_whatsapp_messages m
      where r.conversation_id is not null and m.conversation_id = r.conversation_id
        and m.direction = 'inbound' and m.created_at > r.sent_at and m.type <> 'reaction'
    ) rep on true
  )
  select c.id, c.created_at, c.finished_at, c.status, c.template_name, c.template_category, c.created_by_name, c.source, c.notes, c.official_instance_id,
    count(rr.*), count(*) filter (where rr.st = 'skipped'), count(*) filter (where rr.st = 'error'),
    count(*) filter (where rr.st in ('sent','delivered','read','failed')),
    count(*) filter (where rr.st in ('delivered','read')),
    count(*) filter (where rr.st = 'read'),
    count(*) filter (where rr.st = 'failed'),
    count(*) filter (where rr.billable is true or (rr.billable is null and rr.st in ('delivered','read'))),
    count(*) filter (where rr.first_at is not null),
    count(*) filter (where rr.opt_out)
  from whatsapp_official_campaigns c
  left join rr on rr.campaign_id = c.id
  where c.created_at >= p_from and c.created_at < p_to
    and exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active)
  group by c.id
  order by c.created_at desc
$$;

create or replace function public.official_campaign_errors_range(p_from timestamptz, p_to timestamptz)
returns table(recipient_id uuid, campaign_id uuid, campaign_at timestamptz, template_name text, lead_id uuid,
  lead_name text, phone text, status text, error_text text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select r.id, c.id, c.created_at, c.template_name, r.lead_id, coalesce(l.name, r.lead_name), r.phone,
      public.official_recipient_status(r.status, msg.status) st,
      coalesce(r.error_text, msg.error_text), coalesce(r.failed_at, r.sent_at, r.created_at)
    from whatsapp_official_campaign_recipients r
    join whatsapp_official_campaigns c on c.id = r.campaign_id
    left join crm_whatsapp_messages msg on msg.id = r.message_id
    left join crm_leads l on l.id = r.lead_id
    where c.created_at >= p_from and c.created_at < p_to
      and exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active)
  ) x
  where x.st in ('failed','error')
  order by 10 desc
  limit 5000
$$;

revoke execute on function public.official_campaigns_range(timestamptz, timestamptz) from anon, public;
revoke execute on function public.official_campaign_errors_range(timestamptz, timestamptz) from anon, public;
grant execute on function public.official_campaigns_range(timestamptz, timestamptz) to authenticated;
grant execute on function public.official_campaign_errors_range(timestamptz, timestamptz) to authenticated;
select 'ok' as migrated;
