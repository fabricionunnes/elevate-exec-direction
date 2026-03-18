
-- Marketing consultation forms
CREATE TABLE public.marketing_consultation_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Instagram Analysis
  instagram_handle TEXT,
  instagram_followers TEXT,
  instagram_posting_frequency TEXT,
  instagram_content_types TEXT,
  instagram_engagement_rate TEXT,
  instagram_best_post TEXT,
  instagram_worst_post TEXT,
  instagram_stories_usage TEXT,
  instagram_reels_usage TEXT,
  instagram_bio_optimized TEXT,
  instagram_highlights TEXT,
  instagram_hashtag_strategy TEXT,
  instagram_competitor_profiles TEXT,
  
  -- Brand & Identity
  brand_visual_identity TEXT,
  brand_tone_of_voice TEXT,
  brand_differentiator TEXT,
  brand_positioning TEXT,
  
  -- Content Strategy
  content_planning TEXT,
  content_calendar TEXT,
  content_pillars TEXT,
  content_production_team TEXT,
  
  -- Goals
  marketing_main_goal TEXT,
  marketing_biggest_challenge TEXT,
  marketing_expected_results TEXT,
  marketing_additional_info TEXT,
  
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Financial consultation forms
CREATE TABLE public.financial_consultation_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Revenue & Billing
  monthly_revenue TEXT,
  revenue_sources TEXT,
  average_ticket TEXT,
  payment_methods TEXT,
  default_rate TEXT,
  
  -- Costs & Expenses
  fixed_costs TEXT,
  variable_costs TEXT,
  payroll_cost TEXT,
  biggest_expense TEXT,
  cost_reduction_attempts TEXT,
  
  -- Cash Flow
  cash_flow_control TEXT,
  cash_flow_tool TEXT,
  cash_reserve_months TEXT,
  seasonal_variation TEXT,
  
  -- Financial Planning
  has_budget TEXT,
  profit_margin TEXT,
  pricing_strategy TEXT,
  financial_goals TEXT,
  
  -- Tax & Legal
  tax_regime TEXT,
  accountant_relationship TEXT,
  tax_planning TEXT,
  
  -- Challenges
  financial_biggest_challenge TEXT,
  previous_consultant TEXT,
  expected_financial_results TEXT,
  financial_additional_info TEXT,
  
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.marketing_consultation_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_consultation_forms ENABLE ROW LEVEL SECURITY;

-- Staff can manage all
CREATE POLICY "staff_manage_marketing_forms" ON public.marketing_consultation_forms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_manage_financial_forms" ON public.financial_consultation_forms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public access via token (for filling forms)
CREATE POLICY "public_read_marketing_by_token" ON public.marketing_consultation_forms FOR SELECT TO anon USING (true);
CREATE POLICY "public_update_marketing_by_token" ON public.marketing_consultation_forms FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_read_financial_by_token" ON public.financial_consultation_forms FOR SELECT TO anon USING (true);
CREATE POLICY "public_update_financial_by_token" ON public.financial_consultation_forms FOR UPDATE TO anon USING (true) WITH CHECK (true);
