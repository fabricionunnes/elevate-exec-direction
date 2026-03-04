
-- Allow anonymous SELECT on routine_form_links (public form needs to validate token)
CREATE POLICY "Public can read active form links"
ON public.routine_form_links FOR SELECT TO anon
USING (is_active = true);

-- Allow anonymous INSERT on routine_form_responses (public form submissions)
CREATE POLICY "Public can submit form responses"
ON public.routine_form_responses FOR INSERT TO anon
WITH CHECK (true);
