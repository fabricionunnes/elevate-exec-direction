
CREATE POLICY "Public can read tracks"
ON public.pdi_tracks
FOR SELECT
TO anon, authenticated
USING (true);
