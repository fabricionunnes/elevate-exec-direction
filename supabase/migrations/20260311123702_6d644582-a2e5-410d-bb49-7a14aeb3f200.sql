-- Add commitment and behavioral profile columns to pdi_applications
ALTER TABLE public.pdi_applications
  ADD COLUMN IF NOT EXISTS commitment_meetings text,
  ADD COLUMN IF NOT EXISTS commitment_books text,
  ADD COLUMN IF NOT EXISTS commitment_tasks text,
  ADD COLUMN IF NOT EXISTS commitment_camera text,
  ADD COLUMN IF NOT EXISTS development_readiness text,
  ADD COLUMN IF NOT EXISTS biggest_weakness text,
  ADD COLUMN IF NOT EXISTS time_availability text,
  ADD COLUMN IF NOT EXISTS previous_training text,
  ADD COLUMN IF NOT EXISTS expectations text;