
-- Add staff access policies for financial_bank_accounts
CREATE POLICY "Staff can access bank_accounts"
ON public.financial_bank_accounts FOR ALL
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

-- Add staff access policies for financial_transactions
CREATE POLICY "Staff can access transactions"
ON public.financial_transactions FOR ALL
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
