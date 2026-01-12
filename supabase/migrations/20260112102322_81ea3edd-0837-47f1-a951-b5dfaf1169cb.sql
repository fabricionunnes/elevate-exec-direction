-- Adicionar campos para rastrear quem marcou a reunião e em qual calendário
ALTER TABLE public.onboarding_meeting_notes
ADD COLUMN scheduled_by uuid REFERENCES public.onboarding_staff(id),
ADD COLUMN calendar_owner_id uuid,
ADD COLUMN calendar_owner_name text;

-- Comentários explicativos
COMMENT ON COLUMN public.onboarding_meeting_notes.scheduled_by IS 'Staff member who scheduled the meeting';
COMMENT ON COLUMN public.onboarding_meeting_notes.calendar_owner_id IS 'User ID of the calendar where the meeting was scheduled';
COMMENT ON COLUMN public.onboarding_meeting_notes.calendar_owner_name IS 'Name of the staff whose calendar was used';