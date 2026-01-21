-- Create table to store daily hotseat recordings and transcriptions
CREATE TABLE public.hotseat_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_link TEXT NOT NULL,
  recording_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transcript TEXT,
  summary TEXT,
  companies_mentioned JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'transcribing', 'summarizing', 'completed', 'error')),
  error_message TEXT,
  transcribed_at TIMESTAMPTZ,
  summarized_at TIMESTAMPTZ,
  created_by_staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hotseat_recordings ENABLE ROW LEVEL SECURITY;

-- Policies for staff access only
CREATE POLICY "Staff can view hotseat recordings"
ON public.hotseat_recordings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  )
);

CREATE POLICY "Staff can insert hotseat recordings"
ON public.hotseat_recordings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  )
);

CREATE POLICY "Staff can update hotseat recordings"
ON public.hotseat_recordings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  )
);

-- Index for faster queries
CREATE INDEX idx_hotseat_recordings_date ON public.hotseat_recordings(recording_date DESC);
CREATE INDEX idx_hotseat_recordings_status ON public.hotseat_recordings(status);

-- Add updated_at trigger
CREATE TRIGGER update_hotseat_recordings_updated_at
  BEFORE UPDATE ON public.hotseat_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();