-- Drop existing public submission policies
DROP POLICY IF EXISTS "Public can submit job applications" ON public.candidates;
DROP POLICY IF EXISTS "Public can check duplicate applications" ON public.candidates;
DROP POLICY IF EXISTS "Public can upload resumes for job applications" ON public.candidate_resumes;

-- Parte 1: Política RLS para candidates - permitir ambos cenários
CREATE POLICY "Public can submit applications"
ON public.candidates
FOR INSERT
WITH CHECK (
  -- Cenário 1: Candidatura para vaga específica
  (
    EXISTS (
      SELECT 1 FROM public.job_openings jo 
      WHERE jo.id = candidates.job_opening_id 
      AND jo.status = 'open'
    ) 
    AND source = 'website'
  )
  OR
  -- Cenário 2: Banco de Talentos
  (
    job_opening_id IS NULL 
    AND source = 'public_link' 
    AND project_id = '00000000-0000-0000-0000-000000000001'
    AND current_stage = 'talent_pool'
  )
);

-- Parte 2: Política de verificação de duplicatas
CREATE POLICY "Public can check duplicates"
ON public.candidates
FOR SELECT
USING (
  -- Verificar duplicatas em vagas abertas
  EXISTS (
    SELECT 1 FROM public.job_openings jo 
    WHERE jo.id = candidates.job_opening_id 
    AND jo.status = 'open'
  )
  OR
  -- Verificar duplicatas no banco de talentos
  (
    job_opening_id IS NULL 
    AND current_stage = 'talent_pool'
    AND project_id = '00000000-0000-0000-0000-000000000001'
  )
);

-- Parte 3: Política para upload de currículos em ambos cenários
CREATE POLICY "Public can upload resumes"
ON public.candidate_resumes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.candidates c
    LEFT JOIN public.job_openings jo ON jo.id = c.job_opening_id
    WHERE c.id = candidate_resumes.candidate_id
    AND (
      -- Cenário 1: Candidatura em vaga aberta
      (c.source = 'website' AND jo.status = 'open')
      OR
      -- Cenário 2: Banco de Talentos
      (c.source = 'public_link' AND c.job_opening_id IS NULL)
    )
  )
);