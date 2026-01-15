-- Fix UPDATE policy for customer_points_clients to include WITH CHECK
DROP POLICY IF EXISTS "Public can update client points via QR" ON public.customer_points_clients;

CREATE POLICY "Public can update client points via QR"
ON public.customer_points_clients
FOR UPDATE
USING (true)
WITH CHECK (true);