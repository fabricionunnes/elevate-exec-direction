ALTER TABLE public.meta_ads_accounts 
ADD COLUMN IF NOT EXISTS ig_profile_views integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ig_followers_count integer DEFAULT 0;