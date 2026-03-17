
CREATE TABLE public.traffic_analysis_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.onboarding_projects(id) ON DELETE CASCADE NOT NULL,
  access_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  
  -- Questions
  has_run_ads boolean DEFAULT null,
  platforms_used text DEFAULT null,
  monthly_budget text DEFAULT null,
  budget_management text DEFAULT null,
  main_objective text DEFAULT null,
  target_audience_description text DEFAULT null,
  geographic_targeting text DEFAULT null,
  current_campaigns_types text DEFAULT null,
  best_performing_campaign text DEFAULT null,
  worst_performing_campaign text DEFAULT null,
  average_cpl text DEFAULT null,
  average_cpa text DEFAULT null,
  average_roas text DEFAULT null,
  conversion_tracking text DEFAULT null,
  pixel_installed text DEFAULT null,
  landing_page_url text DEFAULT null,
  landing_page_experience text DEFAULT null,
  creative_production text DEFAULT null,
  ad_frequency_issue text DEFAULT null,
  retargeting_strategy text DEFAULT null,
  lookalike_audiences text DEFAULT null,
  ab_testing text DEFAULT null,
  biggest_challenge text DEFAULT null,
  previous_agency text DEFAULT null,
  expected_results text DEFAULT null,
  additional_info text DEFAULT null,

  submitted_at timestamptz DEFAULT null,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.traffic_analysis_forms ENABLE ROW LEVEL SECURITY;

-- Staff can manage
CREATE POLICY "Staff can manage traffic analysis forms" ON public.traffic_analysis_forms
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

-- Public access via token (for anonymous form submission)
CREATE POLICY "Public access via token" ON public.traffic_analysis_forms
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Public can update via token" ON public.traffic_analysis_forms
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE UNIQUE INDEX traffic_analysis_forms_project_id_idx ON public.traffic_analysis_forms(project_id);
CREATE UNIQUE INDEX traffic_analysis_forms_access_token_idx ON public.traffic_analysis_forms(access_token);
