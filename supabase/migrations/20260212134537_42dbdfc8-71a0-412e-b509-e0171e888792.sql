
-- Allow staff to view tasks they are responsible for
CREATE POLICY "Responsible staff can view their tasks"
ON public.onboarding_tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
      AND os.is_active = true
      AND os.id = responsible_staff_id
  )
);
