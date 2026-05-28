-- Prevent duplicate check-ins: same person, same lesson, same day
CREATE UNIQUE INDEX IF NOT EXISTS pe_checkin_log_once_per_day
  ON public.pe_checkin_log (
    lesson_id,
    lower(attendee_name),
    lower(coalesce(company_name, '')),
    (checked_in_at AT TIME ZONE 'America/Sao_Paulo')::date
  );
