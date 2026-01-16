
-- Create table for decision simulations
CREATE TABLE public.ceo_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('financeira', 'comercial', 'operacional', 'pessoas', 'estrategica')),
  variables JSONB DEFAULT '{}',
  base_data JSONB DEFAULT '{}',
  
  -- Conservative scenario
  conservative_revenue_impact NUMERIC,
  conservative_cash_impact NUMERIC,
  conservative_ebitda_impact NUMERIC,
  conservative_churn_impact NUMERIC,
  conservative_probability INTEGER,
  conservative_analysis TEXT,
  
  -- Realistic scenario
  realistic_revenue_impact NUMERIC,
  realistic_cash_impact NUMERIC,
  realistic_ebitda_impact NUMERIC,
  realistic_churn_impact NUMERIC,
  realistic_probability INTEGER,
  realistic_analysis TEXT,
  
  -- Aggressive scenario
  aggressive_revenue_impact NUMERIC,
  aggressive_cash_impact NUMERIC,
  aggressive_ebitda_impact NUMERIC,
  aggressive_churn_impact NUMERIC,
  aggressive_probability INTEGER,
  aggressive_analysis TEXT,
  
  -- Risk alerts
  risk_alerts TEXT[] DEFAULT '{}',
  timeline_projection JSONB DEFAULT '{}',
  
  -- Status and outcome
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'simulated', 'executed', 'archived')),
  executed_decision_id UUID REFERENCES public.ceo_decisions(id),
  
  -- Accuracy tracking
  actual_revenue_impact NUMERIC,
  actual_cash_impact NUMERIC,
  actual_ebitda_impact NUMERIC,
  actual_churn_impact NUMERIC,
  prediction_error NUMERIC,
  accuracy_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  simulated_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ceo_simulations ENABLE ROW LEVEL SECURITY;

-- RLS policy - only CEO can access
CREATE POLICY "Only CEO can access simulations"
ON public.ceo_simulations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'fabricio@universidadevendas.com.br'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'fabricio@universidadevendas.com.br'
  )
);

-- Create table for simulation learning/accuracy history
CREATE TABLE public.ceo_simulation_learning (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_type TEXT NOT NULL,
  avg_prediction_error NUMERIC DEFAULT 0,
  total_simulations INTEGER DEFAULT 0,
  total_executed INTEGER DEFAULT 0,
  insights TEXT[] DEFAULT '{}',
  adjustment_factors JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ceo_simulation_learning ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Only CEO can access simulation learning"
ON public.ceo_simulation_learning
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'fabricio@universidadevendas.com.br'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'fabricio@universidadevendas.com.br'
  )
);

-- Create indexes
CREATE INDEX idx_simulations_status ON public.ceo_simulations(status);
CREATE INDEX idx_simulations_type ON public.ceo_simulations(decision_type);
CREATE INDEX idx_simulations_created ON public.ceo_simulations(created_at DESC);
