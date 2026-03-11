
-- Attendance table: one record per participant per track per date
CREATE TABLE public.pdi_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.pdi_tracks(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.pdi_participants(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_present BOOLEAN NOT NULL DEFAULT true,
  points_awarded INTEGER NOT NULL DEFAULT 10,
  marked_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(track_id, participant_id, session_date)
);

ALTER TABLE public.pdi_attendance ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public can read attendance"
ON public.pdi_attendance FOR SELECT TO anon, authenticated USING (true);

-- Staff can manage
CREATE POLICY "Staff can manage attendance"
ON public.pdi_attendance FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- Anon can insert (for tokenized access)
CREATE POLICY "Anon can insert attendance"
ON public.pdi_attendance FOR INSERT TO anon WITH CHECK (true);
