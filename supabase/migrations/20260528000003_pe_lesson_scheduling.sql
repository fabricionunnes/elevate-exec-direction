-- Add scheduling and conferencing columns to pe_lessons
ALTER TABLE public.pe_lessons
  ADD COLUMN IF NOT EXISTS scheduled_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meet_link             TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_id     TEXT,
  ADD COLUMN IF NOT EXISTS host_staff_id         UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extra_attendee_emails TEXT;
