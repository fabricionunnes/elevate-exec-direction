CREATE POLICY "CRM staff can insert companies"
  ON public.onboarding_companies FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role IN ('admin', 'master', 'head_comercial', 'closer', 'sdr', 'cs', 'consultant')
  ));