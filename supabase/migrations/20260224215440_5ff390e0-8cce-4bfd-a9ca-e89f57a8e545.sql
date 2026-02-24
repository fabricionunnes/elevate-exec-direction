-- Allow anyone to insert payment links (public page)
DROP POLICY IF EXISTS "Team or owner can insert payment links" ON public.payment_links;

CREATE POLICY "Anyone can insert payment links"
ON public.payment_links
FOR INSERT
WITH CHECK (true);