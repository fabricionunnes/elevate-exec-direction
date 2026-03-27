ALTER TABLE public.meta_ads_campaigns
ADD COLUMN IF NOT EXISTS messaging_conversations_started numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_per_messaging_conversation numeric DEFAULT 0;