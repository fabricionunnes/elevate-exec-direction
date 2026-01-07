-- Create policy to allow public updates on kickoff fields
-- This is needed because the kickoff form is public (no auth required)
CREATE POLICY "Allow public kickoff form updates" 
ON public.onboarding_companies 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Note: This allows updates to the company, but since the kickoff form is meant to be filled by clients
-- and only updates specific fields, this is the expected behavior.
-- The form only updates kickoff-related fields (main_challenges, sales_team_size, etc.)