-- Create table for CEO monthly/yearly planning
CREATE TABLE public.ceo_planning (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  revenue_target NUMERIC DEFAULT 0,
  revenue_actual NUMERIC DEFAULT 0,
  mrr_target NUMERIC DEFAULT 0,
  mrr_actual NUMERIC DEFAULT 0,
  clients_target INTEGER DEFAULT 0,
  clients_actual INTEGER DEFAULT 0,
  churn_target NUMERIC DEFAULT 0,
  churn_actual NUMERIC DEFAULT 0,
  notes TEXT,
  scenario VARCHAR(20) DEFAULT 'realistic' CHECK (scenario IN ('conservative', 'realistic', 'aggressive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);

-- Enable Row Level Security
ALTER TABLE public.ceo_planning ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Only CEO can access
CREATE POLICY "CEO can view planning"
ON public.ceo_planning
FOR SELECT
USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO can insert planning"
ON public.ceo_planning
FOR INSERT
WITH CHECK (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO can update planning"
ON public.ceo_planning
FOR UPDATE
USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO can delete planning"
ON public.ceo_planning
FOR DELETE
USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

-- Create table for CEO strategic goals with flexible timeline
CREATE TABLE public.ceo_strategic_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit VARCHAR(50),
  target_date DATE,
  target_period VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ceo_strategic_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Only CEO can access
CREATE POLICY "CEO can view goals"
ON public.ceo_strategic_goals
FOR SELECT
USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO can insert goals"
ON public.ceo_strategic_goals
FOR INSERT
WITH CHECK (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO can update goals"
ON public.ceo_strategic_goals
FOR UPDATE
USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO can delete goals"
ON public.ceo_strategic_goals
FOR DELETE
USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

-- Trigger for updated_at
CREATE TRIGGER update_ceo_planning_updated_at
BEFORE UPDATE ON public.ceo_planning
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ceo_strategic_goals_updated_at
BEFORE UPDATE ON public.ceo_strategic_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();