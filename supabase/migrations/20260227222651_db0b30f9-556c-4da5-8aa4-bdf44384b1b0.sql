
-- Create staff_financial_cost_centers table
CREATE TABLE public.staff_financial_cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_financial_cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cost centers"
  ON public.staff_financial_cost_centers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage cost centers"
  ON public.staff_financial_cost_centers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff 
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff 
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'master')
    )
  );

-- Add category_id and cost_center_id to company_invoices
ALTER TABLE public.company_invoices 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.staff_financial_categories(id),
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.staff_financial_cost_centers(id);

-- Add cost_center_id to financial_payables (category_id already exists)
ALTER TABLE public.financial_payables 
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.staff_financial_cost_centers(id);

-- Add cost_center_id to staff_financial_entries
ALTER TABLE public.staff_financial_entries
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.staff_financial_cost_centers(id);
