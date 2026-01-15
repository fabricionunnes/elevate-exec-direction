
-- Create table for salesperson access tokens
CREATE TABLE IF NOT EXISTS public.customer_points_salesperson_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  access_token VARCHAR(64) NOT NULL DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 16),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(access_token)
);

-- Enable RLS
ALTER TABLE public.customer_points_salesperson_tokens ENABLE ROW LEVEL SECURITY;

-- Staff can manage tokens
CREATE POLICY "Staff can manage salesperson tokens"
ON public.customer_points_salesperson_tokens
FOR ALL
USING (public.staff_has_company_access(company_id))
WITH CHECK (public.staff_has_company_access(company_id));

-- Clients can manage tokens
CREATE POLICY "Clients can manage salesperson tokens"
ON public.customer_points_salesperson_tokens
FOR ALL
USING (public.client_has_company_access(company_id))
WITH CHECK (public.client_has_company_access(company_id));

-- Public can read active tokens (for validation)
CREATE POLICY "Public can read active tokens"
ON public.customer_points_salesperson_tokens
FOR SELECT
USING (is_active = true);

-- Public insert policies for transactions from salesperson form
DROP POLICY IF EXISTS "Public can insert transactions via QR" ON public.customer_points_transactions;
CREATE POLICY "Public can insert transactions"
ON public.customer_points_transactions
FOR INSERT
WITH CHECK (true);

-- Public select for rules (to calculate points)
CREATE POLICY "Public can view active rules"
ON public.customer_points_rules
FOR SELECT
USING (is_active = true);
