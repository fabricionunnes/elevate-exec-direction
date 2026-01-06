-- Create table for contract renewal history
CREATE TABLE public.onboarding_contract_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  previous_end_date DATE,
  new_end_date DATE NOT NULL,
  previous_value NUMERIC,
  new_value NUMERIC NOT NULL,
  previous_term_months INTEGER,
  new_term_months INTEGER,
  renewal_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  created_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_contract_renewals ENABLE ROW LEVEL SECURITY;

-- Staff can view all renewals
CREATE POLICY "Staff can view contract renewals"
ON public.onboarding_contract_renewals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Admins can manage renewals
CREATE POLICY "Admins can manage contract renewals"
ON public.onboarding_contract_renewals
FOR ALL
USING (is_onboarding_admin())
WITH CHECK (is_onboarding_admin());

-- Add index for performance
CREATE INDEX idx_contract_renewals_company_id ON public.onboarding_contract_renewals(company_id);
CREATE INDEX idx_contract_renewals_renewal_date ON public.onboarding_contract_renewals(renewal_date DESC);