
-- Allow anonymous users (kickoff form) to SELECT pre-UNV sales history
CREATE POLICY "Anon can view pre-UNV sales history"
ON public.company_sales_history
FOR SELECT
TO anon
USING (is_pre_unv = true);

-- Allow anonymous users (kickoff form) to INSERT pre-UNV sales history
CREATE POLICY "Anon can insert pre-UNV sales history"
ON public.company_sales_history
FOR INSERT
TO anon
WITH CHECK (is_pre_unv = true);

-- Allow anonymous users (kickoff form) to DELETE pre-UNV sales history
CREATE POLICY "Anon can delete pre-UNV sales history"
ON public.company_sales_history
FOR DELETE
TO anon
USING (is_pre_unv = true);
