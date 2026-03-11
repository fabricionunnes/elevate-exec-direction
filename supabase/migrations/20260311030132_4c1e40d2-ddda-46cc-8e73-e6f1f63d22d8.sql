CREATE POLICY "Public can view shared reports by token"
ON public.instagram_reports
FOR SELECT
TO anon, authenticated
USING (share_token IS NOT NULL AND share_token != '');