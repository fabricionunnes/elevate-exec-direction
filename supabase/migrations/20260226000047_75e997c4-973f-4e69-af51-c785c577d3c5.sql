CREATE POLICY "Public can view payment links by id"
ON public.payment_links FOR SELECT
TO anon
USING (true);