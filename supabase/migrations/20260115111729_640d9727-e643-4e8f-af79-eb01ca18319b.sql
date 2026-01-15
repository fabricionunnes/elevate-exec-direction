-- Create onboarding_meeting_briefings table
CREATE TABLE public.onboarding_meeting_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL UNIQUE REFERENCES public.onboarding_meeting_notes(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  briefing_content TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_meeting_briefings ENABLE ROW LEVEL SECURITY;

-- RLS policy for staff
CREATE POLICY "Staff can manage briefings" ON public.onboarding_meeting_briefings
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_meeting_briefings_updated_at
BEFORE UPDATE ON public.onboarding_meeting_briefings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();