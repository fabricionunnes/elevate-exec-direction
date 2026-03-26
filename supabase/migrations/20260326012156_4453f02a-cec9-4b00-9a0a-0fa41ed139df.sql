
ALTER TABLE public.slide_presentations
  ADD COLUMN IF NOT EXISTS public_share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.slide_remote_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.slide_presentations(id) ON DELETE CASCADE,
  session_code TEXT NOT NULL UNIQUE,
  current_slide INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.slide_remote_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view remote sessions"
ON public.slide_remote_sessions FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated users can create remote sessions"
ON public.slide_remote_sessions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update remote sessions"
ON public.slide_remote_sessions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete remote sessions"
ON public.slide_remote_sessions FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.slide_remote_sessions;

CREATE POLICY "Anyone can view public presentations"
ON public.slide_presentations FOR SELECT TO public
USING (is_public = true AND public_share_token IS NOT NULL);

CREATE POLICY "Anyone can view slides of public presentations"
ON public.slide_items FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM public.slide_presentations sp
    WHERE sp.id = slide_items.presentation_id
    AND sp.is_public = true
    AND sp.public_share_token IS NOT NULL
  )
);
