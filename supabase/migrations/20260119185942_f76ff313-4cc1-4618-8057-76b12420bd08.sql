-- Add live_notes field to onboarding_meeting_notes table
-- This field stores rich text notes taken during meetings in real-time
ALTER TABLE public.onboarding_meeting_notes
ADD COLUMN live_notes TEXT DEFAULT NULL;