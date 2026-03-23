-- Allow client users to insert companies from CRM (for lead conversion)
CREATE POLICY "Client users can insert companies"
  ON public.onboarding_companies FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
  ));