-- Allow client users (assignee) to update tasks assigned to them
CREATE POLICY "Assignee users can update their tasks"
ON public.onboarding_tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.id = onboarding_tasks.assignee_id
  )
);
