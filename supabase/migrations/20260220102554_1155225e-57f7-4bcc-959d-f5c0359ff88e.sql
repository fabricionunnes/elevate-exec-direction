
-- Add notified_at to track notification status
ALTER TABLE public.crm_activities ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
