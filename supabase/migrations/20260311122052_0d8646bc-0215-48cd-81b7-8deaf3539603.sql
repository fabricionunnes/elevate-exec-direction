-- Allow anonymous users to read cohorts by enrollment_token (for public enrollment page)
CREATE POLICY "Public can read cohorts by enrollment token"
ON public.pdi_cohorts
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to insert applications (public enrollment)
CREATE POLICY "Anon can apply"
ON public.pdi_applications
FOR INSERT
TO anon
WITH CHECK (true);