
-- Table for individual invoices/parcelas linked to recurring charges
CREATE TABLE public.company_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  recurring_charge_id UUID REFERENCES public.company_recurring_charges(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_amount_cents INTEGER,
  payment_method TEXT,
  late_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 2.0,
  daily_interest_percent NUMERIC(5,4) NOT NULL DEFAULT 1.0,
  late_fee_cents INTEGER NOT NULL DEFAULT 0,
  interest_cents INTEGER NOT NULL DEFAULT 0,
  total_with_fees_cents INTEGER GENERATED ALWAYS AS (amount_cents + late_fee_cents + interest_cents) STORED,
  payment_link_url TEXT,
  payment_link_id UUID,
  public_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  installment_number INTEGER DEFAULT 1,
  total_installments INTEGER DEFAULT 1,
  notes TEXT,
  pagarme_charge_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(public_token)
);

-- Index for fast lookups
CREATE INDEX idx_company_invoices_company ON public.company_invoices(company_id);
CREATE INDEX idx_company_invoices_token ON public.company_invoices(public_token);
CREATE INDEX idx_company_invoices_status ON public.company_invoices(status);
CREATE INDEX idx_company_invoices_due_date ON public.company_invoices(due_date);

-- Enable RLS
ALTER TABLE public.company_invoices ENABLE ROW LEVEL SECURITY;

-- Staff can do everything
CREATE POLICY "Staff can manage invoices"
ON public.company_invoices FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
    AND role IN ('admin', 'master', 'cs', 'consultant')
  )
);

-- Clients can view invoices for their company
CREATE POLICY "Clients can view own invoices"
ON public.company_invoices FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    JOIN public.onboarding_projects op ON op.id = ou.project_id
    WHERE ou.user_id = auth.uid()
    AND op.onboarding_company_id = company_invoices.company_id
  )
);

-- Public access by token (for anonymous/public page)
CREATE POLICY "Public access by token"
ON public.company_invoices FOR SELECT
TO anon
USING (true);

-- Updated_at trigger
CREATE TRIGGER update_company_invoices_updated_at
  BEFORE UPDATE ON public.company_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.portal_update_updated_at();
