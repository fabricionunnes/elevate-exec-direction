-- Allow anyone to view company info for NPS survey (only company name is exposed)
CREATE POLICY "Anyone can view company name for NPS" 
ON public.onboarding_companies 
FOR SELECT 
USING (true);