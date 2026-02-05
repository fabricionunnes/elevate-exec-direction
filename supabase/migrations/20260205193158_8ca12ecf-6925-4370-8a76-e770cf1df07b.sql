-- Add column to track publish attempts and error status
ALTER TABLE public.social_content_cards 
ADD COLUMN IF NOT EXISTS publish_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS publish_error text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_publish_attempt_at timestamptz DEFAULT NULL;

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant permissions for cron
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;