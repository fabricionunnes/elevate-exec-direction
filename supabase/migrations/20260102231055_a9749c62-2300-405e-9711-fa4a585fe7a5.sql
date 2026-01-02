
-- Add policy for assigned staff (CS and Consultants) to view and manage tasks in their assigned projects
CREATE POLICY "Assigned staff can view tasks" 
ON public.onboarding_tasks 
FOR SELECT 
USING (is_onboarding_assigned_staff(project_id));

CREATE POLICY "Assigned staff can update tasks" 
ON public.onboarding_tasks 
FOR UPDATE 
USING (is_onboarding_assigned_staff(project_id));

CREATE POLICY "Assigned staff can insert tasks" 
ON public.onboarding_tasks 
FOR INSERT 
WITH CHECK (is_onboarding_assigned_staff(project_id));
