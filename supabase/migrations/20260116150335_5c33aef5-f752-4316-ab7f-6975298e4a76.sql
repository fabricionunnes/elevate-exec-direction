-- Add SLA/target date fields to job_openings for tracking delays
ALTER TABLE public.job_openings 
ADD COLUMN IF NOT EXISTS target_date DATE,
ADD COLUMN IF NOT EXISTS sla_days INTEGER,
ADD COLUMN IF NOT EXISTS responsible_rh_id UUID REFERENCES public.onboarding_staff(id),
ADD COLUMN IF NOT EXISTS consultant_id UUID REFERENCES public.onboarding_staff(id),
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Add index for faster queries on status and dates
CREATE INDEX IF NOT EXISTS idx_job_openings_status ON public.job_openings(status);
CREATE INDEX IF NOT EXISTS idx_job_openings_target_date ON public.job_openings(target_date);
CREATE INDEX IF NOT EXISTS idx_job_openings_created_at ON public.job_openings(created_at);