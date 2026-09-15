create table if not exists public.whatsapp_official_campaigns (
  id uuid primary key default gen_random_uuid(),
  official_instance_id uuid references public.whatsapp_official_instances(id) on delete set null,
  template_name text not null,
  template_language text,
  template_category text,
  body_preview text,
  variables jsonb not null default '[]'::jsonb,
  created_by_staff_id uuid,
  created_by_name text,
  source text,
  move_mode text,
  move_stage_id uuid,
  tag_name text,
  total int not null default 0,
  status text not null default 'sending',
  notes text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.whatsapp_official_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.whatsapp_official_campaigns(id) on delete cascade,
  lead_id uuid,
  lead_name text,
  phone text,
  status text not null default 'pending',
  error_text text,
  whatsapp_message_id text,
  message_id uuid,
  conversation_id uuid,
  moved_from_stage_id uuid,
  moved_to_stage_id uuid,
  stage_reverted boolean not null default false,
  billable boolean,
  pricing_category text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wocr_campaign_idx on public.whatsapp_official_campaign_recipients(campaign_id);
create index if not exists wocr_wamid_idx on public.whatsapp_official_campaign_recipients(whatsapp_message_id) where whatsapp_message_id is not null;
create index if not exists wocr_lead_idx on public.whatsapp_official_campaign_recipients(lead_id, sent_at desc);
create index if not exists woc_created_idx on public.whatsapp_official_campaigns(created_at desc);

alter table public.whatsapp_official_campaigns enable row level security;
alter table public.whatsapp_official_campaign_recipients enable row level security;

do $$ declare t text; begin
  foreach t in array array['whatsapp_official_campaigns','whatsapp_official_campaign_recipients'] loop
    execute format('drop policy if exists "staff le" on public.%I', t);
    execute format('drop policy if exists "staff cria" on public.%I', t);
    execute format('drop policy if exists "staff atualiza" on public.%I', t);
    execute format($p$create policy "staff le" on public.%I for select to authenticated using (exists (select 1 from public.onboarding_staff s where s.user_id = (select auth.uid()) and s.is_active) and not public.current_user_is_tenant())$p$, t);
    execute format($p$create policy "staff cria" on public.%I for insert to authenticated with check (exists (select 1 from public.onboarding_staff s where s.user_id = (select auth.uid()) and s.is_active) and not public.current_user_is_tenant())$p$, t);
    execute format($p$create policy "staff atualiza" on public.%I for update to authenticated using (exists (select 1 from public.onboarding_staff s where s.user_id = (select auth.uid()) and s.is_active) and not public.current_user_is_tenant())$p$, t);
  end loop;
end $$;

alter table public.whatsapp_official_instances
  add column if not exists pricing_rates jsonb not null default '{"MARKETING":0.3125,"UTILITY":0.04,"AUTHENTICATION":0.04}'::jsonb;

-- status efetivo: o webhook pode atualizar a mensagem antes de o disparo gravar o wamid no destinatário
create or replace function public.official_recipient_status(r_status text, m_status text)
returns text language sql immutable as $$
  select case
    when r_status in ('pending','skipped','error') then r_status
    when r_status = 'failed' or m_status = 'failed' then 'failed'
    when r_status = 'read' or m_status = 'read' then 'read'
    when r_status = 'delivered' or m_status = 'delivered' then 'delivered'
    else coalesce(r_status, 'sent') end
$$;

create or replace function public.official_campaigns_list(p_days int default 180)
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
    join whatsapp_official_campaigns c0 on c0.id = r.campaign_id and c0.created_at > now() - make_interval(days => p_days)
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
  where c.created_at > now() - make_interval(days => p_days)
    and exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active)
  group by c.id
  order by c.created_at desc
$$;

create or replace function public.official_campaign_recipients(p_campaign uuid)
returns table(id uuid, lead_id uuid, lead_name text, phone text, status text, error_text text, sent_at timestamptz,
  conversation_id uuid, stage_reverted boolean, billable boolean, reply_text text, reply_at timestamptz, replies bigint,
  stage_name text, pipeline_name text, moved_to_stage_name text)
language sql stable security definer set search_path = public as $$
  select r.id, r.lead_id, coalesce(l.name, r.lead_name), r.phone,
    public.official_recipient_status(r.status, msg.status),
    coalesce(r.error_text, msg.error_text), r.sent_at, r.conversation_id, r.stage_reverted, r.billable,
    fr.content, fr.created_at, coalesce(cnt.n, 0), s.name, p.name, ms.name
  from whatsapp_official_campaign_recipients r
  left join crm_whatsapp_messages msg on msg.id = r.message_id
  left join crm_leads l on l.id = r.lead_id
  left join crm_stages s on s.id = l.stage_id
  left join crm_pipelines p on p.id = l.pipeline_id
  left join crm_stages ms on ms.id = r.moved_to_stage_id
  left join lateral (
    select m.content, m.created_at from crm_whatsapp_messages m
    where r.conversation_id is not null and m.conversation_id = r.conversation_id
      and m.direction = 'inbound' and m.created_at > r.sent_at and m.type <> 'reaction'
    order by m.created_at limit 1
  ) fr on true
  left join lateral (
    select count(*) n from crm_whatsapp_messages m
    where r.conversation_id is not null and m.conversation_id = r.conversation_id
      and m.direction = 'inbound' and m.created_at > r.sent_at and m.type <> 'reaction'
  ) cnt on true
  where r.campaign_id = p_campaign
    and exists (select 1 from onboarding_staff st where st.user_id = auth.uid() and st.is_active)
  order by r.created_at, r.id
$$;

create or replace function public.official_campaign_errors(p_days int default 30)
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
    where c.created_at > now() - make_interval(days => p_days)
      and exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active)
  ) x
  where x.st in ('failed','error')
  order by 10 desc
  limit 5000
$$;

revoke execute on function public.official_campaigns_list(int) from anon, public;
revoke execute on function public.official_campaign_recipients(uuid) from anon, public;
revoke execute on function public.official_campaign_errors(int) from anon, public;
grant execute on function public.official_campaigns_list(int) to authenticated;
grant execute on function public.official_campaign_recipients(uuid) to authenticated;
grant execute on function public.official_campaign_errors(int) to authenticated;
select 'ok' as migrated;
