-- Add renewal tracking fields to onboarding_projects
ALTER TABLE public.onboarding_projects
  ADD COLUMN IF NOT EXISTS renewal_status TEXT,
  ADD COLUMN IF NOT EXISTS renewal_notes TEXT,
  ADD COLUMN IF NOT EXISTS renewal_meeting_date DATE,
  ADD COLUMN IF NOT EXISTS renewed_at TIMESTAMPTZ;

-- Add project_id to renewal history for per-project tracking
ALTER TABLE public.onboarding_contract_renewals
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE SET NULL;
