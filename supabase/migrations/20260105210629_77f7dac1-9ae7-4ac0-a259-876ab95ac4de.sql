-- Allow project members (clients) to update ONLY the sales_result column
CREATE POLICY "Project members can update sales result"
ON public.onboarding_monthly_goals
FOR UPDATE
USING (is_onboarding_project_member(project_id))
WITH CHECK (is_onboarding_project_member(project_id));