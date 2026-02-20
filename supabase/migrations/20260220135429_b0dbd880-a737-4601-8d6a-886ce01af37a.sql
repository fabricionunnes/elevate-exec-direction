-- Allow staff members to update tasks where they are the responsible_staff_id
CREATE POLICY "Responsible staff can update their tasks"
ON public.onboarding_tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.id = onboarding_tasks.responsible_staff_id
  )
);