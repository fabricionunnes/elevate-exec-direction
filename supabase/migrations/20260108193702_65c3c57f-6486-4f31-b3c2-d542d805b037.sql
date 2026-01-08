-- Public assessment access policies (anonymous respondents)

-- 1) Allow anyone to read an ACTIVE cycle by id
ALTER TABLE public.assessment_cycles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assessment_cycles'
      AND policyname = 'Public can read active assessment cycles'
  ) THEN
    CREATE POLICY "Public can read active assessment cycles"
    ON public.assessment_cycles
    FOR SELECT
    USING (status = 'active');
  END IF;
END $$;

-- 2) Allow anyone to create a participant for an ACTIVE cycle
ALTER TABLE public.assessment_participants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assessment_participants'
      AND policyname = 'Public can create participants for active cycles'
  ) THEN
    CREATE POLICY "Public can create participants for active cycles"
    ON public.assessment_participants
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.assessment_cycles c
        WHERE c.id = cycle_id
          AND c.status = 'active'
      )
    );
  END IF;
END $$;

-- 3) Allow anyone to insert DISC responses for an ACTIVE cycle
ALTER TABLE public.disc_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'disc_responses'
      AND policyname = 'Public can submit DISC responses for active cycles'
  ) THEN
    CREATE POLICY "Public can submit DISC responses for active cycles"
    ON public.disc_responses
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.assessment_cycles c
        WHERE c.id = cycle_id
          AND c.status = 'active'
      )
    );
  END IF;
END $$;

-- 4) Allow anyone to insert 360 evaluations for an ACTIVE cycle
ALTER TABLE public.assessment_360_evaluations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assessment_360_evaluations'
      AND policyname = 'Public can submit 360 evaluations for active cycles'
  ) THEN
    CREATE POLICY "Public can submit 360 evaluations for active cycles"
    ON public.assessment_360_evaluations
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.assessment_cycles c
        WHERE c.id = cycle_id
          AND c.status = 'active'
      )
    );
  END IF;
END $$;

-- 5) Allow anyone to insert climate survey responses for an ACTIVE cycle
ALTER TABLE public.climate_survey_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'climate_survey_responses'
      AND policyname = 'Public can submit climate survey responses for active cycles'
  ) THEN
    CREATE POLICY "Public can submit climate survey responses for active cycles"
    ON public.climate_survey_responses
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.assessment_cycles c
        WHERE c.id = cycle_id
          AND c.status = 'active'
      )
    );
  END IF;
END $$;
