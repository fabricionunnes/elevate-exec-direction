-- Add churn reason and notes columns to onboarding_projects
ALTER TABLE public.onboarding_projects
ADD COLUMN churn_reason TEXT,
ADD COLUMN churn_notes TEXT,
ADD COLUMN churn_date TIMESTAMP WITH TIME ZONE;