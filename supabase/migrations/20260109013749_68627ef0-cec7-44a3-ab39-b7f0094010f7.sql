-- Add transcript column to store transcripts separately from notes
ALTER TABLE public.onboarding_meeting_notes 
ADD COLUMN IF NOT EXISTS transcript TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.onboarding_meeting_notes.transcript IS 'Auto-synced transcript from Google Meet (separate from manual notes)';