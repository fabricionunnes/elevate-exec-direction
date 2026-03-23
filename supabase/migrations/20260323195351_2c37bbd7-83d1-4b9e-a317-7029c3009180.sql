CREATE POLICY "CRM staff can insert projects"
  ON public.onboarding_projects FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role IN ('head_comercial', 'closer', 'sdr', 'cs', 'consultant')
  ));