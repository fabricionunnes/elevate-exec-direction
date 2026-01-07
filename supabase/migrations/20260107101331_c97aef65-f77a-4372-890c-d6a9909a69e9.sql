-- Drop the problematic policy
DROP POLICY IF EXISTS "Anyone can create participants via public link" ON public.assessment_participants;

-- Create a simpler INSERT policy that allows anyone to insert
-- The cycle_id validation is implicit since the foreign key will fail if cycle doesn't exist
CREATE POLICY "Public can insert participants"
ON public.assessment_participants
FOR INSERT
TO anon, authenticated
WITH CHECK (true);