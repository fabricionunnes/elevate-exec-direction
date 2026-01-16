-- Drop the current insert policy and recreate with explicit anon role
DROP POLICY IF EXISTS "Anyone can submit NPS response" ON public.onboarding_nps_responses;

-- Create new policy that explicitly allows anonymous inserts
CREATE POLICY "Public can submit NPS response"
ON public.onboarding_nps_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (true);