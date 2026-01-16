-- Drop existing policies
DROP POLICY IF EXISTS "Staff can insert job openings" ON public.job_openings;
DROP POLICY IF EXISTS "Staff can update job openings" ON public.job_openings;
DROP POLICY IF EXISTS "Staff can delete job openings" ON public.job_openings;
DROP POLICY IF EXISTS "Staff can view job openings" ON public.job_openings;

-- Create new policies that also allow clients

-- View: staff with HR access OR client users of the project
CREATE POLICY "Users can view job openings" 
ON public.job_openings 
FOR SELECT 
USING (
  has_hr_view_access(project_id)
);

-- Insert: staff with HR access OR client users of the project can create
CREATE POLICY "Users can insert job openings" 
ON public.job_openings 
FOR INSERT 
WITH CHECK (
  has_hr_edit_access(project_id)
  OR
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.project_id = job_openings.project_id
  )
);

-- Update: only staff with HR access
CREATE POLICY "Staff can update job openings" 
ON public.job_openings 
FOR UPDATE 
USING (has_hr_edit_access(project_id));

-- Delete: only staff with HR access
CREATE POLICY "Staff can delete job openings" 
ON public.job_openings 
FOR DELETE 
USING (has_hr_edit_access(project_id));