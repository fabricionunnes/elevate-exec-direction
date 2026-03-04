
-- ================================================================
-- CALENDÁRIO DE AÇÕES COMERCIAIS
-- ================================================================

-- Table: Global bank of commercial action templates
CREATE TABLE public.commercial_action_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  niche TEXT,
  month INTEGER, -- 1-12
  week INTEGER, -- 1-5
  category TEXT NOT NULL DEFAULT 'Prospecção',
  step_by_step TEXT,
  script TEXT,
  frequency TEXT, -- semanal, mensal, trimestral, anual
  default_responsible TEXT,
  default_deadline_days INTEGER DEFAULT 7,
  default_goal TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: Commercial actions assigned to projects
CREATE TABLE public.commercial_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.commercial_action_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  category TEXT NOT NULL DEFAULT 'Prospecção',
  step_by_step TEXT,
  script TEXT,
  start_date DATE,
  deadline DATE,
  responsible_staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'medium',
  goal TEXT,
  result TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  recurrence TEXT,
  task_id UUID REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL,
  month INTEGER,
  week INTEGER,
  year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commercial_action_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_actions ENABLE ROW LEVEL SECURITY;

-- RLS for templates: only staff can access
CREATE POLICY "Staff can view action templates"
  ON public.commercial_action_templates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Staff can insert action templates"
  ON public.commercial_action_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Staff can update action templates"
  ON public.commercial_action_templates FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Staff can delete action templates"
  ON public.commercial_action_templates FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true
  ));

-- RLS for actions: only staff can access
CREATE POLICY "Staff can view commercial actions"
  ON public.commercial_actions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Staff can insert commercial actions"
  ON public.commercial_actions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Staff can update commercial actions"
  ON public.commercial_actions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Staff can delete commercial actions"
  ON public.commercial_actions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true
  ));

-- Indexes for performance
CREATE INDEX idx_commercial_actions_project ON public.commercial_actions(project_id);
CREATE INDEX idx_commercial_actions_status ON public.commercial_actions(status);
CREATE INDEX idx_commercial_actions_responsible ON public.commercial_actions(responsible_staff_id);
CREATE INDEX idx_commercial_actions_year_month ON public.commercial_actions(year, month);
CREATE INDEX idx_commercial_action_templates_niche ON public.commercial_action_templates(niche);
CREATE INDEX idx_commercial_action_templates_category ON public.commercial_action_templates(category);

-- Updated_at trigger for templates
CREATE TRIGGER update_commercial_action_templates_updated_at
  BEFORE UPDATE ON public.commercial_action_templates
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

-- Updated_at trigger for actions
CREATE TRIGGER update_commercial_actions_updated_at
  BEFORE UPDATE ON public.commercial_actions
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();
