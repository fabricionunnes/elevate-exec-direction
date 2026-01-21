-- Add DELETE policy for staff
CREATE POLICY "Staff can delete hotseat recordings"
ON public.hotseat_recordings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  )
);