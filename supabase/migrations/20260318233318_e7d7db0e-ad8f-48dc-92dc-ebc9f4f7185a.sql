-- FIX 1: generated_contracts - restrict to admin staff only
DROP POLICY IF EXISTS "Anyone can view contracts" ON public.generated_contracts;
DROP POLICY IF EXISTS "Anyone can insert contracts" ON public.generated_contracts;
DROP POLICY IF EXISTS "Anyone can update contracts" ON public.generated_contracts;
DROP POLICY IF EXISTS "Anyone can delete contracts" ON public.generated_contracts;

CREATE POLICY "Admin staff can view contracts"
  ON public.generated_contracts FOR SELECT
  TO authenticated
  USING (
    public.is_onboarding_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'master')
    )
  );

CREATE POLICY "Admin staff can insert contracts"
  ON public.generated_contracts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_onboarding_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'master')
    )
  );

CREATE POLICY "Admin staff can update contracts"
  ON public.generated_contracts FOR UPDATE
  TO authenticated
  USING (
    public.is_onboarding_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'master')
    )
  )
  WITH CHECK (
    public.is_onboarding_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'master')
    )
  );

CREATE POLICY "Admin staff can delete contracts"
  ON public.generated_contracts FOR DELETE
  TO authenticated
  USING (
    public.is_onboarding_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'master')
    )
  );

-- FIX 2: mastermind_applications - add DELETE policy for admins
CREATE POLICY "Admins can delete mastermind applications"
  ON public.mastermind_applications FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));