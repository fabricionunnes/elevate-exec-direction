
-- Create table for NPS responses history
CREATE TABLE public.onboarding_nps_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  feedback TEXT,
  what_can_improve TEXT,
  would_recommend_why TEXT,
  respondent_name TEXT,
  respondent_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_nps_responses_project_id ON public.onboarding_nps_responses(project_id);
CREATE INDEX idx_nps_responses_created_at ON public.onboarding_nps_responses(created_at DESC);

-- Enable RLS
ALTER TABLE public.onboarding_nps_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (public form)
CREATE POLICY "Anyone can submit NPS response"
ON public.onboarding_nps_responses
FOR INSERT
WITH CHECK (true);

-- Policy: Project members and staff can view responses
CREATE POLICY "Project members can view NPS responses"
ON public.onboarding_nps_responses
FOR SELECT
USING (
  is_onboarding_project_member(project_id) 
  OR is_onboarding_admin() 
  OR is_onboarding_assigned_staff(project_id)
);

-- Trigger to update project's current_nps when new response is added
CREATE OR REPLACE FUNCTION public.update_project_nps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.onboarding_projects
  SET current_nps = NEW.score,
      updated_at = now()
  WHERE id = NEW.project_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_nps_response_insert
AFTER INSERT ON public.onboarding_nps_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_project_nps();
