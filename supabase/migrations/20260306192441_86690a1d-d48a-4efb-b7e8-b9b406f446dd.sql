
-- Drop the anon-only INSERT policy and recreate for public (both anon and authenticated)
DROP POLICY IF EXISTS "Public can insert entries" ON public.kpi_entries;
CREATE POLICY "Public can insert entries" ON public.kpi_entries
  FOR INSERT TO public
  WITH CHECK (true);

-- Also fix SELECT policy to cover authenticated non-staff users accessing the entry page
DROP POLICY IF EXISTS "Public can view own entries" ON public.kpi_entries;
CREATE POLICY "Public can view own entries" ON public.kpi_entries
  FOR SELECT TO public
  USING (true);

-- Fix DELETE policy role
DROP POLICY IF EXISTS "Public can delete own entries for update" ON public.kpi_entries;
CREATE POLICY "Public can delete own entries for update" ON public.kpi_entries
  FOR DELETE TO public
  USING (true);

-- Fix UPDATE policy to ensure it works for both roles
DROP POLICY IF EXISTS "Public can update own entries" ON public.kpi_entries;
CREATE POLICY "Public can update own entries" ON public.kpi_entries
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);
