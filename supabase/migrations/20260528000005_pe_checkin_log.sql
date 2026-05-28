-- pe_checkin_log: presença pública via link (sem auth)
CREATE TABLE IF NOT EXISTS public.pe_checkin_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id        UUID NOT NULL REFERENCES public.pe_lessons(id) ON DELETE CASCADE,
  attendee_name    TEXT NOT NULL,
  company_name     TEXT,
  checked_in_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  certificate_url  TEXT
);

ALTER TABLE public.pe_checkin_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe_checkin_log_anon_insert"
  ON public.pe_checkin_log FOR INSERT WITH CHECK (true);

CREATE POLICY "pe_checkin_log_auth_select"
  ON public.pe_checkin_log FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pe_checkin_log_auth_update"
  ON public.pe_checkin_log FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "pe_checkin_log_auth_delete"
  ON public.pe_checkin_log FOR DELETE USING (auth.role() = 'authenticated');

GRANT INSERT ON public.pe_checkin_log TO anon;
GRANT SELECT, UPDATE, DELETE ON public.pe_checkin_log TO authenticated;

-- Allow anon to read company names for autocomplete on check-in page
CREATE POLICY "onboarding_companies_anon_names"
  ON public.onboarding_companies FOR SELECT USING (true);
GRANT SELECT (id, name) ON public.onboarding_companies TO anon;

-- Allow anon to read active lesson info (only for code validation)
CREATE POLICY "pe_lessons_anon_active"
  ON public.pe_lessons FOR SELECT USING (status = 'active');
GRANT SELECT (id, title, checkin_code, status, track_id) ON public.pe_lessons TO anon;
