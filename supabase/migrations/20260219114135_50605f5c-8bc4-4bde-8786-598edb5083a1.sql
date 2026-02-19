
-- Table to persist strategic planning per project
CREATE TABLE public.project_strategic_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  raw_content TEXT NOT NULL,
  editable_cronograma JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.project_strategic_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage strategic plans" ON public.project_strategic_plans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Project members can view strategic plans" ON public.project_strategic_plans
  FOR SELECT USING (
    public.is_onboarding_project_member(project_id)
  );

CREATE TRIGGER update_project_strategic_plans_updated_at
  BEFORE UPDATE ON public.project_strategic_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.portal_update_updated_at();
