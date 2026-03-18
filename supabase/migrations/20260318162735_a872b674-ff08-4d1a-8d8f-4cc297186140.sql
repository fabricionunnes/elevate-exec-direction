
-- Table to track service purchases by clients
CREATE TABLE public.service_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  service_catalog_id UUID NOT NULL REFERENCES public.service_catalog(id),
  menu_key TEXT NOT NULL,
  billing_type TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' or 'one_time'
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'blocked', 'cancelled'
  recurring_charge_id UUID REFERENCES public.company_recurring_charges(id),
  asaas_subscription_id TEXT,
  purchased_by UUID NOT NULL REFERENCES public.onboarding_users(id),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_purchases ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read their own project's purchases
CREATE POLICY "Users can read own project purchases"
  ON public.service_purchases
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT ou.project_id FROM public.onboarding_users ou
      WHERE ou.user_id = auth.uid()
    )
  );

-- Policy: authenticated users can insert purchases for their own project
CREATE POLICY "Users can insert own project purchases"
  ON public.service_purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT ou.project_id FROM public.onboarding_users ou
      WHERE ou.user_id = auth.uid()
    )
  );

-- Index for faster lookups
CREATE INDEX idx_service_purchases_project_id ON public.service_purchases(project_id);
CREATE INDEX idx_service_purchases_recurring_charge_id ON public.service_purchases(recurring_charge_id);
