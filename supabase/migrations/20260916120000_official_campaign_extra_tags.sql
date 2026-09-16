alter table public.whatsapp_official_campaigns add column if not exists extra_tag_ids uuid[] not null default '{}'::uuid[];
