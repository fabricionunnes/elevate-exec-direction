-- Create social_briefing_forms table (was missing from migrations)
CREATE TABLE IF NOT EXISTS public.social_briefing_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.social_briefing_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage briefing forms" ON public.social_briefing_forms
  FOR ALL USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()));
