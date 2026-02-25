
-- Add company_id to payment_links and pagarme_orders for company-level tracking
ALTER TABLE public.payment_links ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.onboarding_companies(id) ON DELETE SET NULL;
ALTER TABLE public.pagarme_orders ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.onboarding_companies(id) ON DELETE SET NULL;

-- Create company_recurring_charges table for recurring billing config
CREATE TABLE IF NOT EXISTS public.company_recurring_charges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount_cents integer NOT NULL,
  payment_method text NOT NULL DEFAULT 'credit_card',
  installments integer NOT NULL DEFAULT 1,
  recurrence text NOT NULL DEFAULT 'monthly', -- monthly, quarterly, yearly
  next_charge_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_document text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for company_recurring_charges
ALTER TABLE public.company_recurring_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view company recurring charges"
  ON public.company_recurring_charges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Staff can manage company recurring charges"
  ON public.company_recurring_charges FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('admin', 'master', 'cs')
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_payment_links_company_id ON public.payment_links(company_id);
CREATE INDEX IF NOT EXISTS idx_pagarme_orders_company_id ON public.pagarme_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_company_recurring_charges_company_id ON public.company_recurring_charges(company_id);
