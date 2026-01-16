-- Add fields for decision mapping with KPIs and evaluation
ALTER TABLE public.ceo_decisions
ADD COLUMN IF NOT EXISTS linked_kpis TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS evaluation_period INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS estimated_impact NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_result TEXT CHECK (final_result IN ('positive', 'neutral', 'negative')),
ADD COLUMN IF NOT EXISTS evaluation_start_date DATE,
ADD COLUMN IF NOT EXISTS evaluation_end_date DATE,
ADD COLUMN IF NOT EXISTS actual_impact NUMERIC,
ADD COLUMN IF NOT EXISTS ai_analysis TEXT;

-- Create table for decision map AI insights
CREATE TABLE IF NOT EXISTS public.ceo_decision_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('pattern', 'recommendation', 'alert')),
  area TEXT,
  insight TEXT NOT NULL,
  supporting_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ceo_decision_insights ENABLE ROW LEVEL SECURITY;

-- Create policies for CEO access only
CREATE POLICY "CEO can view decision insights" 
ON public.ceo_decision_insights 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

CREATE POLICY "CEO can insert decision insights" 
ON public.ceo_decision_insights 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

CREATE POLICY "CEO can delete decision insights" 
ON public.ceo_decision_insights 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'fabricio@universidadevendas.com.br'
  )
);