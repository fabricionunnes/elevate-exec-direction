-- Table to store pending NPS celebrations for each staff member
CREATE TABLE public.onboarding_nps_celebrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nps_response_id UUID NOT NULL REFERENCES public.onboarding_nps_responses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(nps_response_id, staff_id)
);

-- Enable RLS
ALTER TABLE public.onboarding_nps_celebrations ENABLE ROW LEVEL SECURITY;

-- Staff can see their own celebrations
CREATE POLICY "Staff can view own celebrations"
ON public.onboarding_nps_celebrations
FOR SELECT
USING (
  staff_id IN (
    SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Staff can update their own celebrations (mark as seen)
CREATE POLICY "Staff can update own celebrations"
ON public.onboarding_nps_celebrations
FOR UPDATE
USING (
  staff_id IN (
    SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_nps_celebrations;

-- Function to create celebration entries for all active staff when NPS 10 is received
CREATE OR REPLACE FUNCTION public.create_nps_celebration_entries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff RECORD;
BEGIN
  -- Only for score 10
  IF NEW.score != 10 THEN
    RETURN NEW;
  END IF;

  -- Create celebration entry for each active staff member
  FOR v_staff IN 
    SELECT id FROM public.onboarding_staff WHERE is_active = true
  LOOP
    INSERT INTO public.onboarding_nps_celebrations (nps_response_id, staff_id)
    VALUES (NEW.id, v_staff.id)
    ON CONFLICT (nps_response_id, staff_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger to create celebration entries on NPS 10 insert
CREATE TRIGGER create_nps_celebration_entries_trigger
AFTER INSERT ON public.onboarding_nps_responses
FOR EACH ROW
EXECUTE FUNCTION public.create_nps_celebration_entries();