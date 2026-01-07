-- Add public SELECT policy for assessment_cycles (so public links can check cycle info)
CREATE POLICY "Anyone can view active assessment cycles via public link"
ON public.assessment_cycles
FOR SELECT
USING (status = 'active');

-- Add public INSERT policy for assessment_participants (so public users can register)
CREATE POLICY "Anyone can create participants via public link"
ON public.assessment_participants
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM assessment_cycles ac
    WHERE ac.id = cycle_id AND ac.status = 'active'
  )
);