
CREATE TABLE public.cfo_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT,
  applied_at TIMESTAMPTZ,
  applied_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cfo_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage cfo_ai_insights"
  ON public.cfo_ai_insights
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
