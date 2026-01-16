-- Add policy for public access to job openings (for public application page)
CREATE POLICY "Public can view open job openings" ON public.job_openings
  FOR SELECT USING (status = 'open');

-- Note: The existing "Staff can view job openings" policy is kept for internal management