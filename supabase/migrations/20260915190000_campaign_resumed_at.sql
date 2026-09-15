alter table public.whatsapp_official_campaigns add column if not exists resumed_at timestamptz; select 'ok' as migrated;
