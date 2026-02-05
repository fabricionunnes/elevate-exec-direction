-- Add missing facebook_page_id column to social_instagram_accounts
ALTER TABLE public.social_instagram_accounts 
ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;