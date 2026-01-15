-- Allow public read access to customer_points_config for the salesperson form
CREATE POLICY "Public can view active config"
ON public.customer_points_config FOR SELECT
USING (is_active = true);

-- Allow public read access to customer_points_clients for searching by CPF
CREATE POLICY "Public can view clients"
ON public.customer_points_clients FOR SELECT
USING (true);