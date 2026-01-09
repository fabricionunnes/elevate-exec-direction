-- Add renewal_meeting_date column to onboarding_companies
ALTER TABLE public.onboarding_companies 
ADD COLUMN IF NOT EXISTS renewal_meeting_date DATE;