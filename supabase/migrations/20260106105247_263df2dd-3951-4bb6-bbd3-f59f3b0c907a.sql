-- Add columns to store cancellation signal reason and notes
ALTER TABLE public.onboarding_projects
ADD COLUMN IF NOT EXISTS cancellation_signal_reason text,
ADD COLUMN IF NOT EXISTS cancellation_signal_notes text,
ADD COLUMN IF NOT EXISTS cancellation_signal_date timestamp with time zone;