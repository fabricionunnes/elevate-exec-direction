
-- Allow anon users to update remote sessions (for phone remote control without login)
CREATE POLICY "Anyone can update remote sessions"
ON public.slide_remote_sessions FOR UPDATE
TO public
USING (true);

-- Allow anon users to insert remote sessions
CREATE POLICY "Anyone can insert remote sessions"
ON public.slide_remote_sessions FOR INSERT
TO public
WITH CHECK (true);
