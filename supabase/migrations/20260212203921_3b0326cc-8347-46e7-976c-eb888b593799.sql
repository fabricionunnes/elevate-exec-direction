
-- Allow ANY authenticated user to SELECT pre-UNV sales history (for kickoff form when logged in)
CREATE POLICY "Authenticated can view pre-UNV sales history"
ON public.company_sales_history
FOR SELECT
TO authenticated
USING (is_pre_unv = true);

-- Allow ANY authenticated user to INSERT pre-UNV sales history
CREATE POLICY "Authenticated can insert pre-UNV sales history"
ON public.company_sales_history
FOR INSERT
TO authenticated
WITH CHECK (is_pre_unv = true);

-- Allow ANY authenticated user to DELETE pre-UNV sales history
CREATE POLICY "Authenticated can delete pre-UNV sales history"
ON public.company_sales_history
FOR DELETE
TO authenticated
USING (is_pre_unv = true);
