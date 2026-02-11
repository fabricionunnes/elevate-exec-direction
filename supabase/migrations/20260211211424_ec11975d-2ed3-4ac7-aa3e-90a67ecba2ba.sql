
-- Career Plan Strategic Form Responses
CREATE TABLE public.career_plan_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  respondent_name TEXT,
  respondent_role TEXT,
  respondent_email TEXT,
  -- General Info
  company_segment TEXT,
  employee_count TEXT,
  current_role_structure TEXT,
  company_culture_type TEXT,
  has_career_plan BOOLEAN DEFAULT false,
  current_career_plan_details TEXT,
  -- Growth Strategy
  growth_preference TEXT, -- vertical, horizontal, both
  values_most TEXT, -- leadership, technical, commercial
  -- Compensation Policy
  salary_ranges TEXT,
  raise_policy TEXT, -- time, merit, result
  benefits_by_level TEXT,
  -- Evaluation & Performance
  current_evaluation_criteria TEXT,
  evaluation_frequency TEXT,
  uses_goals BOOLEAN DEFAULT false,
  goal_types TEXT[], -- sales, projects, behavior, learning
  additional_notes TEXT,
  is_complete BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Career Plan Versions
CREATE TABLE public.career_plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  version_name TEXT,
  is_active BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  generated_by_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  published_at TIMESTAMPTZ,
  published_by TEXT,
  notes TEXT
);

-- Career Tracks (vertical or horizontal paths)
CREATE TABLE public.career_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.career_plan_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  track_type TEXT NOT NULL DEFAULT 'vertical', -- vertical, horizontal
  department TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Career Roles (positions within tracks)
CREATE TABLE public.career_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.career_tracks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  level_order INT NOT NULL DEFAULT 0,
  -- Compensation
  salary_base NUMERIC,
  salary_min NUMERIC,
  salary_max NUMERIC,
  benefits TEXT,
  -- Time
  min_time_months INT,
  max_time_months INT,
  -- Status
  is_entry_level BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Career Criteria (evaluation criteria per role)
CREATE TABLE public.career_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.career_roles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  weight NUMERIC DEFAULT 1,
  min_score NUMERIC DEFAULT 7,
  criteria_type TEXT DEFAULT 'performance', -- performance, behavior, goals, evaluation, learning
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Career Goals (goals per role)
CREATE TABLE public.career_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.career_roles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT DEFAULT 'quantitative', -- quantitative, qualitative
  target_value TEXT,
  measurement_unit TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Career Evaluations (employee evaluations)
CREATE TABLE public.career_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.career_plan_versions(id),
  employee_name TEXT NOT NULL,
  employee_email TEXT,
  current_role_id UUID REFERENCES public.career_roles(id),
  evaluation_date TIMESTAMPTZ DEFAULT now(),
  overall_score NUMERIC,
  status TEXT DEFAULT 'in_progress', -- in_progress, completed, eligible, not_eligible, developing
  time_in_role_months INT,
  criteria_scores JSONB DEFAULT '[]',
  goals_achieved JSONB DEFAULT '[]',
  evaluator_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Career Audit Log
CREATE TABLE public.career_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.career_plan_versions(id),
  action TEXT NOT NULL,
  action_details JSONB,
  performed_by_staff_id UUID,
  performed_by_user_id UUID,
  performed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.career_plan_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Staff can access based on project membership
CREATE POLICY "Staff can view career_plan_forms" ON public.career_plan_forms
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
    OR public.is_onboarding_project_member(project_id)
  );
CREATE POLICY "Staff can insert career_plan_forms" ON public.career_plan_forms
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
    OR public.is_onboarding_project_member(project_id)
  );
CREATE POLICY "Staff can update career_plan_forms" ON public.career_plan_forms
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Staff can view career_plan_versions" ON public.career_plan_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
    OR public.is_onboarding_project_member(project_id)
  );
CREATE POLICY "Staff can manage career_plan_versions" ON public.career_plan_versions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Staff can view career_tracks" ON public.career_tracks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (
      SELECT 1 FROM public.career_plan_versions v
      WHERE v.id = version_id AND public.is_onboarding_project_member(v.project_id)
    )
  );
CREATE POLICY "Staff can manage career_tracks" ON public.career_tracks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Staff can view career_roles" ON public.career_roles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (
      SELECT 1 FROM public.career_tracks t
      JOIN public.career_plan_versions v ON v.id = t.version_id
      WHERE t.id = track_id AND public.is_onboarding_project_member(v.project_id)
    )
  );
CREATE POLICY "Staff can manage career_roles" ON public.career_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Staff can view career_criteria" ON public.career_criteria
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (
      SELECT 1 FROM public.career_roles r
      JOIN public.career_tracks t ON t.id = r.track_id
      JOIN public.career_plan_versions v ON v.id = t.version_id
      WHERE r.id = role_id AND public.is_onboarding_project_member(v.project_id)
    )
  );
CREATE POLICY "Staff can manage career_criteria" ON public.career_criteria
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Staff can view career_goals" ON public.career_goals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
    OR EXISTS (
      SELECT 1 FROM public.career_roles r
      JOIN public.career_tracks t ON t.id = r.track_id
      JOIN public.career_plan_versions v ON v.id = t.version_id
      WHERE r.id = role_id AND public.is_onboarding_project_member(v.project_id)
    )
  );
CREATE POLICY "Staff can manage career_goals" ON public.career_goals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Staff can view career_evaluations" ON public.career_evaluations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
    OR public.is_onboarding_project_member(project_id)
  );
CREATE POLICY "Staff can manage career_evaluations" ON public.career_evaluations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Staff can view career_audit_log" ON public.career_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );
CREATE POLICY "Staff can insert career_audit_log" ON public.career_audit_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );
