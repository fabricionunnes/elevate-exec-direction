-- =============================================
-- FASE 2: CHECK-INS TABLE
-- =============================================
CREATE TABLE public.portal_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_result_id UUID NOT NULL REFERENCES public.portal_key_results(id) ON DELETE CASCADE,
  week_ref DATE NOT NULL,
  current_value NUMERIC,
  previous_value NUMERIC,
  comment TEXT,
  impediments TEXT,
  next_action TEXT,
  status progress_status NOT NULL DEFAULT 'on_track',
  created_by UUID REFERENCES public.portal_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_checkins ENABLE ROW LEVEL SECURITY;

-- RLS for check-ins
CREATE POLICY "Members can manage checkins of their key results"
  ON public.portal_checkins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.portal_key_results kr
      JOIN public.portal_objectives o ON o.id = kr.objective_id
      JOIN public.portal_plans p ON p.id = o.plan_id
      WHERE kr.id = key_result_id AND public.is_portal_company_member(auth.uid(), p.company_id)
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_portal_checkins_updated_at
  BEFORE UPDATE ON public.portal_checkins
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

-- =============================================
-- RECOMMENDATIONS TABLE
-- =============================================
CREATE TABLE public.portal_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.portal_companies(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.portal_plans(id) ON DELETE CASCADE,
  key_result_id UUID REFERENCES public.portal_key_results(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.portal_product_catalog(id) ON DELETE CASCADE,
  reason TEXT,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their recommendations"
  ON public.portal_recommendations FOR SELECT
  USING (public.is_portal_company_member(auth.uid(), company_id));

CREATE POLICY "Members can dismiss their recommendations"
  ON public.portal_recommendations FOR UPDATE
  USING (public.is_portal_company_member(auth.uid(), company_id));

CREATE POLICY "System can insert recommendations"
  ON public.portal_recommendations FOR INSERT
  WITH CHECK (true);