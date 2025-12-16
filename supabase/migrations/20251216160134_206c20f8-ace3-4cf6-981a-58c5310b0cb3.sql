-- Create table for closer diagnostics
CREATE TABLE public.closer_diagnostics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Fase 1 - Rapport
  client_name TEXT NOT NULL,
  company TEXT NOT NULL,
  role TEXT,
  segment TEXT,
  rapport_notes TEXT,
  connection_point TEXT,
  
  -- Fase 2 - Expectativas
  expectations_aligned TEXT,
  client_agreed TEXT,
  
  -- Fase 3 - Decisores
  decision_maker TEXT,
  partner_name TEXT,
  partner_present TEXT,
  decision_process TEXT,
  
  -- Fase 4 - A Razão
  why_scheduled TEXT,
  specific_help TEXT,
  what_saw_about_us TEXT,
  why_now TEXT,
  
  -- Fase 5 - Dores
  main_pains TEXT[],
  pain_details TEXT,
  how_long_problem TEXT,
  how_affects_life TEXT,
  emotional_impact TEXT,
  
  -- Fase 6 - Tentou
  what_tried_before TEXT,
  why_didnt_work TEXT,
  
  -- Fase 7 - Situação
  revenue TEXT,
  team_size TEXT,
  avg_ticket TEXT,
  sales_cycle TEXT,
  lead_volume TEXT,
  lead_source TEXT[],
  conversion TEXT,
  has_process TEXT,
  has_crm TEXT,
  crm_name TEXT,
  goal_12_months TEXT,
  ideal_scenario TEXT,
  realistic_expectation TEXT,
  
  -- Fase 8 - Porquê
  deeper_why TEXT,
  what_would_change TEXT,
  love_or_status TEXT,
  
  -- Fase 9 - Admissão
  admission_statement TEXT,
  why_cant_alone TEXT,
  
  -- Fase 10 - Compromisso
  when_to_fix TEXT,
  commitment_level INTEGER DEFAULT 3,
  is_coachable TEXT,
  
  -- Fase 11 - Fechamento
  budget TEXT,
  timeline TEXT,
  
  -- Fase 12 - Contexto adicional
  additional_context TEXT,
  
  -- Resultado
  recommended_products JSONB,
  recommended_trail JSONB,
  summary TEXT,
  
  -- Admin
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  closer_id UUID
);

-- Enable RLS
ALTER TABLE public.closer_diagnostics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can read closer diagnostics"
ON public.closer_diagnostics
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update closer diagnostics"
ON public.closer_diagnostics
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can submit closer diagnostic"
ON public.closer_diagnostics
FOR INSERT
WITH CHECK (true);