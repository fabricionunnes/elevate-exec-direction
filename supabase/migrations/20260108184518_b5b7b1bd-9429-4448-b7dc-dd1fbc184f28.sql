-- Create table for climate survey responses
CREATE TABLE public.climate_survey_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES public.assessment_cycles(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.assessment_participants(id) ON DELETE CASCADE,
  respondent_name TEXT NOT NULL,
  respondent_email TEXT,
  
  -- Satisfação geral
  company_satisfaction INTEGER CHECK (company_satisfaction >= 1 AND company_satisfaction <= 5),
  organizational_culture INTEGER CHECK (organizational_culture >= 0 AND organizational_culture <= 5),
  feels_valued TEXT CHECK (feels_valued IN ('very_much', 'not_enough', 'little', 'not_at_all')),
  
  -- Relacionamento com superiores
  communication_with_superiors INTEGER CHECK (communication_with_superiors >= 0 AND communication_with_superiors <= 5),
  superior_interest_development INTEGER CHECK (superior_interest_development >= 0 AND superior_interest_development <= 5),
  feels_supported INTEGER CHECK (feels_supported >= 0 AND feels_supported <= 5),
  
  -- Desenvolvimento e crescimento
  has_growth_opportunities BOOLEAN,
  receives_feedback TEXT CHECK (receives_feedback IN ('frequently', 'rarely', 'never')),
  training_rating INTEGER CHECK (training_rating >= 1 AND training_rating <= 5),
  
  -- Equilíbrio vida profissional/pessoal
  company_values_balance BOOLEAN,
  company_offers_wellness BOOLEAN,
  manages_responsibilities BOOLEAN,
  
  -- Reconhecimento e recompensas
  feels_valued_for_work BOOLEAN,
  adequate_recognition BOOLEAN,
  rewards_rating INTEGER CHECK (rewards_rating >= 1 AND rewards_rating <= 5),
  
  -- Ambiente de trabalho
  feels_comfortable_safe BOOLEAN,
  good_coworker_relationship BOOLEAN,
  diversity_inclusion INTEGER CHECK (diversity_inclusion >= 1 AND diversity_inclusion <= 5),
  
  -- Perguntas abertas
  what_company_does_well TEXT,
  what_company_should_improve TEXT,
  enjoys_working_score INTEGER CHECK (enjoys_working_score >= 0 AND enjoys_working_score <= 5),
  would_recommend_score INTEGER CHECK (would_recommend_score >= 0 AND would_recommend_score <= 5),
  open_feedback TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.climate_survey_responses ENABLE ROW LEVEL SECURITY;

-- Allow public inserts for active cycles (like other assessment tables)
CREATE POLICY "Allow public insert for climate responses"
ON public.climate_survey_responses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assessment_cycles
    WHERE id = cycle_id AND status = 'active'
  )
);

-- Allow staff to read climate responses
CREATE POLICY "Staff can view climate responses"
ON public.climate_survey_responses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_climate_responses_cycle ON public.climate_survey_responses(cycle_id);
CREATE INDEX idx_climate_responses_participant ON public.climate_survey_responses(participant_id);