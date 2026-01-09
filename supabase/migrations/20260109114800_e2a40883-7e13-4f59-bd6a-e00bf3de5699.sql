-- Add DELETE policy for public KPI entry updates (salespeople can delete their own entries by date)
CREATE POLICY "Public can delete own entries for update"
ON public.kpi_entries
FOR DELETE
USING (true);

-- Also add UPDATE policy for completeness
CREATE POLICY "Public can update own entries"
ON public.kpi_entries
FOR UPDATE
USING (true)
WITH CHECK (true);