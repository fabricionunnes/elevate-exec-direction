-- Drop existing policies for hiring_pipeline_stages
DROP POLICY IF EXISTS "Staff can manage pipeline stages" ON public.hiring_pipeline_stages;
DROP POLICY IF EXISTS "Users can view pipeline stages" ON public.hiring_pipeline_stages;

-- Create separate policies with proper WITH CHECK clauses
CREATE POLICY "Users can view pipeline stages" 
ON public.hiring_pipeline_stages 
FOR SELECT 
USING (has_hr_view_access(project_id));

CREATE POLICY "Staff can insert pipeline stages" 
ON public.hiring_pipeline_stages 
FOR INSERT 
WITH CHECK (has_hr_edit_access(project_id));

CREATE POLICY "Staff can update pipeline stages" 
ON public.hiring_pipeline_stages 
FOR UPDATE 
USING (has_hr_edit_access(project_id))
WITH CHECK (has_hr_edit_access(project_id));

CREATE POLICY "Staff can delete pipeline stages" 
ON public.hiring_pipeline_stages 
FOR DELETE 
USING (has_hr_edit_access(project_id));