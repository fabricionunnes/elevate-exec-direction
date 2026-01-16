-- Add missing columns to interviews table for Google Calendar integration
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS meet_link TEXT,
ADD COLUMN IF NOT EXISTS calendar_event_id TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;