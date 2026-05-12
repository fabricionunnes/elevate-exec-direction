
ALTER TABLE public.onboarding_companies
  ADD COLUMN IF NOT EXISTS north_star_metric_cents BIGINT,
  ADD COLUMN IF NOT EXISTS north_star_metric_label TEXT;

CREATE TABLE IF NOT EXISTS public.north_star_alerts_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  month_year DATE NOT NULL,
  threshold INTEGER NOT NULL CHECK (threshold IN (70, 90, 100)),
  achieved_value_cents BIGINT NOT NULL DEFAULT 0,
  target_value_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, month_year, threshold)
);

CREATE INDEX IF NOT EXISTS idx_nsm_alerts_company_month ON public.north_star_alerts_sent (company_id, month_year);

ALTER TABLE public.north_star_alerts_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view NSM alerts"
  ON public.north_star_alerts_sent FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff s WHERE s.user_id = auth.uid() AND s.is_active = true)
  );

CREATE POLICY "System can insert NSM alerts"
  ON public.north_star_alerts_sent FOR INSERT
  WITH CHECK (true);
