
-- Add cost_type to staff_financial_categories for fixed vs variable distinction
ALTER TABLE public.staff_financial_categories 
ADD COLUMN IF NOT EXISTS cost_type text DEFAULT NULL;

-- Comment: cost_type values: 'fixed', 'variable', NULL (for revenue categories)
COMMENT ON COLUMN public.staff_financial_categories.cost_type IS 'fixed or variable cost classification';

-- Financial employees table for headcount tracking
CREATE TABLE IF NOT EXISTS public.financial_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  department text,
  salary_cents bigint NOT NULL DEFAULT 0,
  benefits_cents bigint NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_employees_select" ON public.financial_employees
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "financial_employees_insert" ON public.financial_employees
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('master', 'admin'))
  );

CREATE POLICY "financial_employees_update" ON public.financial_employees
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('master', 'admin'))
  );

CREATE POLICY "financial_employees_delete" ON public.financial_employees
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('master', 'admin'))
  );

-- Financial alert thresholds config
CREATE TABLE IF NOT EXISTS public.financial_alert_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL UNIQUE,
  label text NOT NULL,
  threshold numeric NOT NULL,
  comparison text NOT NULL DEFAULT 'gt', -- gt, lt, gte, lte
  severity text NOT NULL DEFAULT 'warning', -- info, warning, critical
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_alert_config_select" ON public.financial_alert_config
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "financial_alert_config_all" ON public.financial_alert_config
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('master', 'admin'))
  );

-- Insert default alert thresholds
INSERT INTO public.financial_alert_config (alert_key, label, threshold, comparison, severity) VALUES
  ('ltv_cac_ratio', 'LTV/CAC < 2', 2, 'lt', 'critical'),
  ('churn_rate', 'Churn > 5%', 5, 'gt', 'warning'),
  ('payroll_revenue_ratio', 'Folha > 50% da Receita', 50, 'gt', 'warning'),
  ('runway_months', 'Runway < 6 meses', 6, 'lt', 'critical'),
  ('delinquency_rate', 'Inadimplência > 8%', 8, 'gt', 'warning')
ON CONFLICT (alert_key) DO NOTHING;

-- Financial monthly targets for budget comparison
CREATE TABLE IF NOT EXISTS public.financial_monthly_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month text NOT NULL, -- YYYY-MM format
  metric_key text NOT NULL, -- mrr, revenue, ebitda, churn, cac, etc.
  target_value numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(year_month, metric_key)
);

ALTER TABLE public.financial_monthly_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_monthly_targets_select" ON public.financial_monthly_targets
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "financial_monthly_targets_all" ON public.financial_monthly_targets
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('master', 'admin'))
  );
