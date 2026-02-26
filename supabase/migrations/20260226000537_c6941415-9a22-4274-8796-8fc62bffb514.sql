DROP POLICY IF EXISTS "Public can view payment links by id" ON public.payment_links;

CREATE POLICY "Public can view payment links by id"
ON public.payment_links
FOR SELECT
TO anon, authenticated
USING (true);