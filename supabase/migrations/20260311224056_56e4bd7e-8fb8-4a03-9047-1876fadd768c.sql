CREATE TABLE public.commercial_director_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  commercial_score integer,
  score_classification text,
  diagnosis jsonb,
  radar jsonb,
  insights jsonb,
  growth_plan jsonb,
  priorities jsonb,
  forecast jsonb,
  full_analysis text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commercial_director_analyses_project ON public.commercial_director_analyses(project_id, created_at DESC);

ALTER TABLE public.commercial_director_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage analyses" ON public.commercial_director_analyses
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff s
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can read own project analyses" ON public.commercial_director_analyses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_users u
      WHERE u.user_id = auth.uid()
      AND u.project_id = commercial_director_analyses.project_id
    )
  );

CREATE POLICY "Clients can insert own project analyses" ON public.commercial_director_analyses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_users u
      WHERE u.user_id = auth.uid()
      AND u.project_id = commercial_director_analyses.project_id
    )
  );