-- Add is_internal column to mark meetings that should not be visible to clients
ALTER TABLE public.onboarding_meeting_notes 
ADD COLUMN is_internal boolean DEFAULT false;

-- Update the RLS policy so clients can only see finalized meetings that are NOT internal
DROP POLICY IF EXISTS "Clients can view finalized meetings" ON public.onboarding_meeting_notes;

CREATE POLICY "Clients can view finalized non-internal meetings"
ON public.onboarding_meeting_notes
FOR SELECT
USING (
  is_finalized = true
  AND (is_internal = false OR is_internal IS NULL)
  AND EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.project_id = onboarding_meeting_notes.project_id
  )
);