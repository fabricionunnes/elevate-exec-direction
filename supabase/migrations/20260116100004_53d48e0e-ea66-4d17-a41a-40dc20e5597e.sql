-- Create table for CEO Score history
CREATE TABLE public.ceo_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_score INTEGER NOT NULL CHECK (total_score >= 0 AND total_score <= 100),
  focus_score INTEGER NOT NULL CHECK (focus_score >= 0 AND focus_score <= 100),
  execution_score INTEGER NOT NULL CHECK (execution_score >= 0 AND execution_score <= 100),
  clarity_score INTEGER NOT NULL CHECK (clarity_score >= 0 AND clarity_score <= 100),
  consistency_score INTEGER NOT NULL CHECK (consistency_score >= 0 AND consistency_score <= 100),
  classification TEXT NOT NULL,
  insights TEXT[] DEFAULT '{}',
  metrics_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ceo_scores ENABLE ROW LEVEL SECURITY;

-- Create policy for fabricio only
CREATE POLICY "Only fabricio can access ceo_scores"
ON public.ceo_scores
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'fabricio@universidadevendas.com.br'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'fabricio@universidadevendas.com.br'
  )
);