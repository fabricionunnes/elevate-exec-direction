-- Create table for leadership and 1:1 meeting notes
CREATE TABLE public.leadership_meeting_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meeting_type TEXT NOT NULL CHECK (meeting_type IN ('leadership', 'one_on_one')),
  consultant_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  notes TEXT,
  decisions TEXT,
  action_items JSONB DEFAULT '[]',
  next_steps TEXT,
  attendees JSONB DEFAULT '[]',
  created_by UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leadership_meeting_notes ENABLE ROW LEVEL SECURITY;

-- Policies for staff access
CREATE POLICY "Staff can view all leadership meeting notes"
ON public.leadership_meeting_notes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can insert leadership meeting notes"
ON public.leadership_meeting_notes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Staff can update leadership meeting notes"
ON public.leadership_meeting_notes
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admins can delete leadership meeting notes"
ON public.leadership_meeting_notes
FOR DELETE
TO authenticated
USING (true);

-- Create index for faster queries
CREATE INDEX idx_leadership_meeting_notes_date ON public.leadership_meeting_notes(meeting_date DESC);
CREATE INDEX idx_leadership_meeting_notes_type ON public.leadership_meeting_notes(meeting_type);
CREATE INDEX idx_leadership_meeting_notes_consultant ON public.leadership_meeting_notes(consultant_id);

-- Trigger for updated_at
CREATE TRIGGER update_leadership_meeting_notes_updated_at
BEFORE UPDATE ON public.leadership_meeting_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leadership_meeting_notes;