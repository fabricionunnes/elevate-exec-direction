-- Corrigir política de INSERT para disc_responses permitindo acesso anônimo
DROP POLICY IF EXISTS "Anyone can insert DISC responses" ON public.disc_responses;
CREATE POLICY "Public can insert DISC responses for active cycles"
ON public.disc_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM assessment_cycles ac
    WHERE ac.id = disc_responses.cycle_id AND ac.status = 'active'
  )
);

-- Corrigir política de INSERT para assessment_participants permitindo acesso anônimo  
DROP POLICY IF EXISTS "Anyone can insert participants for active cycles" ON public.assessment_participants;
CREATE POLICY "Public can insert participants for active cycles"
ON public.assessment_participants
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM assessment_cycles ac
    WHERE ac.id = assessment_participants.cycle_id AND ac.status = 'active'
  )
);

-- Corrigir política de INSERT para assessment_360_evaluations permitindo acesso anônimo
DROP POLICY IF EXISTS "Anyone can insert 360 evaluations" ON public.assessment_360_evaluations;
CREATE POLICY "Public can insert 360 evaluations for active cycles"
ON public.assessment_360_evaluations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM assessment_cycles ac
    WHERE ac.id = assessment_360_evaluations.cycle_id AND ac.status = 'active'
  )
);

-- Corrigir política de INSERT para climate_survey_responses permitindo acesso anônimo
DROP POLICY IF EXISTS "Allow public insert for climate responses" ON public.climate_survey_responses;
CREATE POLICY "Public can insert climate responses for active cycles"
ON public.climate_survey_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM assessment_cycles ac
    WHERE ac.id = climate_survey_responses.cycle_id AND ac.status = 'active'
  )
);

-- Garantir que assessment_cycles possa ser lido por usuários anônimos (ciclos ativos)
DROP POLICY IF EXISTS "Anyone can view active assessment cycles via public link" ON public.assessment_cycles;
CREATE POLICY "Anon can view active assessment cycles"
ON public.assessment_cycles
FOR SELECT
TO anon
USING (status = 'active');