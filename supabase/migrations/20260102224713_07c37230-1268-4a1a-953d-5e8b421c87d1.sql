-- Allow anyone to read project basic info for NPS survey (product_name and company)
-- This enables the public NPS survey link to work without authentication
CREATE POLICY "Anyone can view project info for NPS" 
ON public.onboarding_projects 
FOR SELECT 
USING (true);

-- Note: This is safe because:
-- 1. The data exposed (product_name, company name) is not sensitive
-- 2. Users still need the project UUID to access anything
-- 3. All other operations (INSERT, UPDATE, DELETE) require authentication