-- Drop the restrictive delete policy
DROP POLICY IF EXISTS "Staff can delete their own meeting notes" ON public.onboarding_meeting_notes;

-- Create a new policy that allows:
-- 1. Staff who created the meeting (staff_id)
-- 2. Calendar owner (calendar_owner_id)
-- 3. Admin/master staff
CREATE POLICY "Staff can delete meeting notes" ON public.onboarding_meeting_notes
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND (
      os.id = onboarding_meeting_notes.staff_id
      OR os.id = onboarding_meeting_notes.calendar_owner_id
      OR os.role IN ('admin', 'master')
    )
  )
);