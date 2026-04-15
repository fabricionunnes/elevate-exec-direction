-- Create client-side commission tiers (what the client pays UNV per achievement tier)
CREATE TABLE public.sf_commission_client_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.sf_commission_configs(id) ON DELETE CASCADE,
  min_percent NUMERIC NOT NULL DEFAULT 0,
  max_percent NUMERIC,
  commission_type TEXT NOT NULL DEFAULT 'fixed',
  commission_value NUMERIC NOT NULL DEFAULT 0,
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sf_commission_client_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sf_commission_client_tiers"
  ON public.sf_commission_client_tiers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Remove the fixed client_pays_amount column since it's now tier-based
-- Keep it for backward compatibility but it becomes optional
