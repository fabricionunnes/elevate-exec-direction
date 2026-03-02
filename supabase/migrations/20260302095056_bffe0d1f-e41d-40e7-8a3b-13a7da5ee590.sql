
-- Fix company_invoices RLS to include 'financeiro' and 'rh' roles
DROP POLICY IF EXISTS "Staff can manage invoices" ON public.company_invoices;
CREATE POLICY "Staff can manage invoices"
ON public.company_invoices FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Add staff access to financial_payables (currently only is_financial_admin)
CREATE POLICY "Staff can access payables"
ON public.financial_payables FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
);
