-- Add renewed_at column to track when a company renewed their contract
-- This is used to give a health score bonus for recent renewals
ALTER TABLE public.onboarding_companies 
ADD COLUMN IF NOT EXISTS renewed_at TIMESTAMP WITH TIME ZONE;