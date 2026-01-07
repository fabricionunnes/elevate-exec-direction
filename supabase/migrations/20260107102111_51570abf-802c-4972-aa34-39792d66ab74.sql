-- Replace participant public insert policy to ensure it applies for any request role
DROP POLICY IF EXISTS "Public can insert participants" ON public.assessment_participants;

CREATE POLICY "Anyone can insert participants for active cycles"
ON public.assessment_participants
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assessment_cycles ac
    WHERE ac.id = cycle_id AND ac.status = 'active'
  )
);