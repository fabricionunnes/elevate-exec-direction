-- Drop the restrictive UPDATE policy
DROP POLICY IF EXISTS "Staff can update their own meeting notes" ON public.onboarding_meeting_notes;

-- Create a new policy that allows any active staff to update any meeting
CREATE POLICY "Staff can update any meeting notes"
ON public.onboarding_meeting_notes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);