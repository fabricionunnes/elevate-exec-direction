alter table public.whatsapp_official_campaigns add column if not exists template_body text;
alter table public.whatsapp_official_campaign_recipients add column if not exists claimed_at timestamptz;
create index if not exists wocr_pending_idx on public.whatsapp_official_campaign_recipients(campaign_id, created_at) where status in ('pending','processing');
create index if not exists woc_staff_created_idx on public.whatsapp_official_campaigns(created_by_staff_id, created_at desc);

create or replace function public.official_recipient_status(r_status text, m_status text)
returns text language sql immutable as $$
  select case
    when r_status in ('pending','processing','skipped','error') then r_status
    when r_status = 'failed' or m_status = 'failed' then 'failed'
    when r_status = 'read' or m_status = 'read' then 'read'
    when r_status = 'delivered' or m_status = 'delivered' then 'delivered'
    else coalesce(r_status, 'sent') end
$$;
select 'ok' as migrated;
