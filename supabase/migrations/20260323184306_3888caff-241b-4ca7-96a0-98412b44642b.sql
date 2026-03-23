CREATE POLICY "Anyone can view active pipeline forms"
ON public.crm_pipeline_forms
FOR SELECT
TO anon
USING (is_active = true);