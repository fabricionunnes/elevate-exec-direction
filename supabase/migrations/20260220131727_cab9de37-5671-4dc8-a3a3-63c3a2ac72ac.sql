
DROP POLICY IF EXISTS "Staff can view assigned companies" ON public.onboarding_companies;

CREATE POLICY "Staff can view assigned companies"
ON public.onboarding_companies
FOR SELECT
TO authenticated
USING (
  -- Direct assignment at company level
  cs_id IN (SELECT id FROM onboarding_staff WHERE user_id = auth.uid())
  OR consultant_id IN (SELECT id FROM onboarding_staff WHERE user_id = auth.uid())
  -- Project-level assignment
  OR id IN (
    SELECT op.onboarding_company_id
    FROM onboarding_projects op
    WHERE op.onboarding_company_id IS NOT NULL
      AND (
        op.consultant_id IN (SELECT id FROM onboarding_staff WHERE user_id = auth.uid())
        OR op.cs_id IN (SELECT id FROM onboarding_staff WHERE user_id = auth.uid())
      )
  )
);
