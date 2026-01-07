-- Tabela para armazenar o histórico de reuniões realizadas com clientes
CREATE TABLE public.onboarding_meeting_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.onboarding_staff(id),
  google_event_id TEXT,
  meeting_title TEXT NOT NULL,
  meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
  subject TEXT NOT NULL,
  notes TEXT,
  attendees TEXT,
  meeting_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_meeting_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view all meeting notes
CREATE POLICY "Staff can view all meeting notes" 
ON public.onboarding_meeting_notes 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Policy: Staff can create meeting notes
CREATE POLICY "Staff can create meeting notes" 
ON public.onboarding_meeting_notes 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Policy: Staff can update their own meeting notes
CREATE POLICY "Staff can update their own meeting notes" 
ON public.onboarding_meeting_notes 
FOR UPDATE 
TO authenticated
USING (
  staff_id IN (
    SELECT os.id FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Policy: Staff can delete their own meeting notes
CREATE POLICY "Staff can delete their own meeting notes" 
ON public.onboarding_meeting_notes 
FOR DELETE 
TO authenticated
USING (
  staff_id IN (
    SELECT os.id FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Index for faster queries
CREATE INDEX idx_meeting_notes_project_id ON public.onboarding_meeting_notes(project_id);
CREATE INDEX idx_meeting_notes_staff_id ON public.onboarding_meeting_notes(staff_id);
CREATE INDEX idx_meeting_notes_meeting_date ON public.onboarding_meeting_notes(meeting_date DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_meeting_notes_updated_at
BEFORE UPDATE ON public.onboarding_meeting_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.onboarding_meeting_notes IS 'Histórico de reuniões realizadas com clientes, incluindo assuntos e notas';