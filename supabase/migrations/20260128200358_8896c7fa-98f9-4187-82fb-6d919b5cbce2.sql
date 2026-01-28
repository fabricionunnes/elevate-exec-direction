-- Allow anonymous access to culture form links for public form
DROP POLICY IF EXISTS "Public can access active form links" ON public.culture_form_links;
CREATE POLICY "Public can access active form links"
ON public.culture_form_links
FOR SELECT
TO anon
USING (is_active = true);

-- Allow anonymous access to insert form responses
DROP POLICY IF EXISTS "Public can submit form responses" ON public.culture_form_responses;
CREATE POLICY "Public can submit form responses"
ON public.culture_form_responses
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous access to insert audit log entries
DROP POLICY IF EXISTS "Public can insert audit log" ON public.culture_manual_audit_log;
CREATE POLICY "Public can insert audit log"
ON public.culture_manual_audit_log
FOR INSERT
TO anon
WITH CHECK (true);