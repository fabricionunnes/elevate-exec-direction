CREATE TABLE IF NOT EXISTS public.north_star_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  target_cents bigint NOT NULL,
  achieved_cents bigint NOT NULL DEFAULT 0,
  month_year date NOT NULL,
  label text,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsm_achievements_company ON public.north_star_achievements(company_id, archived_at DESC);

ALTER TABLE public.north_star_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view nsm achievements"
ON public.north_star_achievements FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert nsm achievements"
ON public.north_star_achievements FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can delete nsm achievements"
ON public.north_star_achievements FOR DELETE
TO authenticated
USING (true);