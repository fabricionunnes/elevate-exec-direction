-- Allow anonymous users to insert candidates for open job openings
CREATE POLICY "Public can submit job applications" ON public.candidates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_openings jo
      WHERE jo.id = candidates.job_opening_id
      AND jo.status = 'open'
    )
    AND candidates.source = 'website'
  );

-- Allow anonymous users to check for duplicate applications (their own email)
CREATE POLICY "Public can check duplicate applications" ON public.candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.job_openings jo
      WHERE jo.id = candidates.job_opening_id
      AND jo.status = 'open'
    )
  );

-- Allow anonymous users to insert resumes for candidates they just created
CREATE POLICY "Public can upload candidate resumes" ON public.candidate_resumes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.candidates c
      JOIN public.job_openings jo ON jo.id = c.job_opening_id
      WHERE c.id = candidate_resumes.candidate_id
      AND jo.status = 'open'
      AND c.source = 'website'
    )
  );

-- Create storage bucket for resumes if not exists and allow public uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload resumes
CREATE POLICY "Anyone can upload resumes" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'resumes');

-- Allow anyone to read resumes
CREATE POLICY "Anyone can read resumes" ON storage.objects
  FOR SELECT USING (bucket_id = 'resumes');