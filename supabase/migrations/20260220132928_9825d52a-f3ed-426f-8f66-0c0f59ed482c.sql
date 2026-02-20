-- Fix RLS policy for onboarding_task_history to allow staff assigned at project level
DROP POLICY IF EXISTS "Project members and staff can insert task history" ON public.onboarding_task_history;

CREATE POLICY "Project members and staff can insert task history"
ON public.onboarding_task_history
FOR INSERT
WITH CHECK (
  -- Project members (onboarding_users)
  task_id IN (
    SELECT t.id FROM onboarding_tasks t
    WHERE is_onboarding_project_member(t.project_id)
  )
  OR
  -- Admin users
  is_onboarding_admin()
  OR
  -- Active staff members (consultants, CS, etc.)
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
  )
);