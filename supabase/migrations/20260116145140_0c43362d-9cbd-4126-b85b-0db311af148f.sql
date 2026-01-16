-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Candidates can update their own disc via token" ON public.candidate_disc_results;

-- Create a corrected policy that allows update when CURRENT status is pending
-- The WITH CHECK verifies the NEW row, but we need USING to check CURRENT row
CREATE POLICY "Candidates can update their own disc via token" ON public.candidate_disc_results
  FOR UPDATE 
  USING (status = 'pending')
  WITH CHECK (true);