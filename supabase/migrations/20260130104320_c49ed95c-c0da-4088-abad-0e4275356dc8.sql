-- Remove política antiga que estava bloqueando uploads do banco de talentos
DROP POLICY IF EXISTS "Public can upload candidate resumes" ON public.candidate_resumes;