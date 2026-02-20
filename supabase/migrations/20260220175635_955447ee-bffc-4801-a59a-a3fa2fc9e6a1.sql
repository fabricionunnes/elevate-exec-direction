
-- Drop and recreate the assignee policy with proper WITH CHECK
DROP POLICY IF EXISTS "Assignee users can update their tasks" ON public.onboarding_tasks;

CREATE POLICY "Assignee users can update their tasks"
ON public.onboarding_tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.id = onboarding_tasks.assignee_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.id = onboarding_tasks.assignee_id
  )
);

-- Also fix the responsible staff policy to include WITH CHECK
DROP POLICY IF EXISTS "Responsible staff can update their tasks" ON public.onboarding_tasks;

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
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.id = onboarding_tasks.responsible_staff_id
  )
);
