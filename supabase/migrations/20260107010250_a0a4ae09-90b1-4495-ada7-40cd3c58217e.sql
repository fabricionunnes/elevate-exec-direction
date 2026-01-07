-- Add is_finalized column to track meeting completion
ALTER TABLE public.onboarding_meeting_notes 
ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN NOT NULL DEFAULT false;

-- Update existing meetings: mark as finalized if they have notes
UPDATE public.onboarding_meeting_notes 
SET is_finalized = true 
WHERE notes IS NOT NULL AND notes != '';

-- Create index for performance when querying unfinalized meetings
CREATE INDEX IF NOT EXISTS idx_meeting_notes_finalized 
ON public.onboarding_meeting_notes(is_finalized, staff_id) 
WHERE is_finalized = false;