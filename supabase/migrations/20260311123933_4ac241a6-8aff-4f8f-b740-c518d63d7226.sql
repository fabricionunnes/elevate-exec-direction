-- Add scope/targeting columns to pdi_tracks
ALTER TABLE public.pdi_tracks
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES public.pdi_cohorts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES public.pdi_participants(id) ON DELETE CASCADE;

-- Add scope/targeting columns to pdi_tasks
ALTER TABLE public.pdi_tasks
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES public.pdi_cohorts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES public.pdi_participants(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.pdi_tracks.scope IS 'global = all cohorts, cohort = specific cohort, participant = specific participant';
COMMENT ON COLUMN public.pdi_tasks.scope IS 'global = all cohorts, cohort = specific cohort, participant = specific participant';