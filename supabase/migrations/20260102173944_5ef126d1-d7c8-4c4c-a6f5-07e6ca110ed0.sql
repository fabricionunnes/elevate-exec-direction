-- Drop the existing SELECT policy for task history
DROP POLICY IF EXISTS "Project members can view task history" ON public.onboarding_task_history;

-- Create a new SELECT policy that includes staff admins and assigned staff
CREATE POLICY "Project members and staff can view task history"
ON public.onboarding_task_history
FOR SELECT
USING (
  (task_id IN (
    SELECT t.id FROM onboarding_tasks t
    WHERE is_onboarding_project_member(t.project_id)
  ))
  OR is_onboarding_admin()
  OR (task_id IN (
    SELECT t.id FROM onboarding_tasks t
    WHERE is_onboarding_assigned_staff(t.project_id)
  ))
);