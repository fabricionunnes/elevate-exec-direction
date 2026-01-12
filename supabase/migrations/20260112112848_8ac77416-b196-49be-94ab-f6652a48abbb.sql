-- Add is_no_show column to track when client doesn't attend the meeting
ALTER TABLE public.onboarding_meeting_notes 
ADD COLUMN is_no_show boolean DEFAULT false;