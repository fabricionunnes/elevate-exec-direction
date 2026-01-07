-- Create policy to allow clients to view finalized meetings for their projects
CREATE POLICY "Clients can view finalized meetings"
ON public.onboarding_meeting_notes
FOR SELECT
USING (
  is_finalized = true
  AND EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.project_id = onboarding_meeting_notes.project_id
  )
);