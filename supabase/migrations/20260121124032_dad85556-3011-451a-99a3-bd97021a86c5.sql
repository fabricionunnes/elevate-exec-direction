-- Create hotseat_responses table
CREATE TABLE public.hotseat_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  respondent_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  
  -- Admin fields
  linked_company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE SET NULL,
  linked_project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create hotseat_notes table for consultant-visible notes
CREATE TABLE public.hotseat_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotseat_response_id UUID NOT NULL REFERENCES public.hotseat_responses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by_staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hotseat_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotseat_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hotseat_responses
CREATE POLICY "Staff can view all hotseat responses"
ON public.hotseat_responses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('admin', 'cs')
  )
);

CREATE POLICY "Staff can update hotseat responses"
ON public.hotseat_responses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('admin', 'cs')
  )
);

CREATE POLICY "Staff can insert hotseat responses"
ON public.hotseat_responses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('admin', 'cs')
  )
);

-- RLS Policies for hotseat_notes
CREATE POLICY "Staff can view hotseat notes"
ON public.hotseat_notes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('admin', 'cs', 'consultant')
  )
);

CREATE POLICY "Admin and CS can manage hotseat notes"
ON public.hotseat_notes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('admin', 'cs')
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_hotseat_responses_updated_at
  BEFORE UPDATE ON public.hotseat_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hotseat_notes_updated_at
  BEFORE UPDATE ON public.hotseat_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_hotseat_responses_status ON public.hotseat_responses(status);
CREATE INDEX idx_hotseat_responses_linked_company ON public.hotseat_responses(linked_company_id);
CREATE INDEX idx_hotseat_notes_response ON public.hotseat_notes(hotseat_response_id);