
-- Allow anonymous users to insert career plan forms via public token (project_id)
CREATE POLICY "Public can insert career_plan_forms" ON public.career_plan_forms
  FOR INSERT WITH CHECK (true);
