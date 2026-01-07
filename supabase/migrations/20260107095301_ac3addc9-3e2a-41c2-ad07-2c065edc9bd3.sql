-- =====================================================
-- PESQUISA 360° E DISC - TABELAS PRINCIPAIS
-- =====================================================

-- Tabela para armazenar os ciclos de avaliação 360°
CREATE TABLE public.assessment_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Ciclo de Avaliação',
  type TEXT NOT NULL CHECK (type IN ('360', 'disc', 'both')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft')),
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para participantes das avaliações (funcionários e proprietários)
CREATE TABLE public.assessment_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES public.assessment_cycles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'employee', 'peer')),
  department TEXT,
  access_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de respostas do DISC (28 perguntas, cada uma com 4 opções DISC)
CREATE TABLE public.disc_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES public.assessment_cycles(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.assessment_participants(id) ON DELETE CASCADE,
  respondent_name TEXT NOT NULL,
  respondent_email TEXT,
  -- Scores calculados para cada dimensão (0-100)
  dominance_score INTEGER NOT NULL DEFAULT 0,
  influence_score INTEGER NOT NULL DEFAULT 0,
  steadiness_score INTEGER NOT NULL DEFAULT 0,
  conscientiousness_score INTEGER NOT NULL DEFAULT 0,
  -- Perfil primário e secundário identificado
  primary_profile TEXT CHECK (primary_profile IN ('D', 'I', 'S', 'C')),
  secondary_profile TEXT CHECK (secondary_profile IN ('D', 'I', 'S', 'C')),
  -- Respostas brutas das 28 perguntas (JSON com as escolhas)
  raw_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de avaliações 360° (quem avalia quem)
CREATE TABLE public.assessment_360_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES public.assessment_cycles(id) ON DELETE CASCADE,
  evaluated_id UUID NOT NULL REFERENCES public.assessment_participants(id) ON DELETE CASCADE,
  evaluator_id UUID REFERENCES public.assessment_participants(id) ON DELETE SET NULL,
  evaluator_name TEXT NOT NULL,
  evaluator_email TEXT,
  relationship TEXT NOT NULL CHECK (relationship IN ('self', 'manager', 'peer', 'subordinate')),
  -- Competências avaliadas (1-5 para cada)
  leadership_score INTEGER CHECK (leadership_score BETWEEN 1 AND 5),
  communication_score INTEGER CHECK (communication_score BETWEEN 1 AND 5),
  teamwork_score INTEGER CHECK (teamwork_score BETWEEN 1 AND 5),
  conflict_management_score INTEGER CHECK (conflict_management_score BETWEEN 1 AND 5),
  proactivity_score INTEGER CHECK (proactivity_score BETWEEN 1 AND 5),
  results_delivery_score INTEGER CHECK (results_delivery_score BETWEEN 1 AND 5),
  -- Comentários abertos
  strengths TEXT,
  improvements TEXT,
  additional_comments TEXT,
  -- Status
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_assessment_cycles_project ON public.assessment_cycles(project_id);
CREATE INDEX idx_assessment_participants_cycle ON public.assessment_participants(cycle_id);
CREATE INDEX idx_assessment_participants_token ON public.assessment_participants(access_token);
CREATE INDEX idx_disc_responses_cycle ON public.disc_responses(cycle_id);
CREATE INDEX idx_disc_responses_participant ON public.disc_responses(participant_id);
CREATE INDEX idx_360_evaluations_cycle ON public.assessment_360_evaluations(cycle_id);
CREATE INDEX idx_360_evaluations_evaluated ON public.assessment_360_evaluations(evaluated_id);

-- RLS
ALTER TABLE public.assessment_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disc_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_360_evaluations ENABLE ROW LEVEL SECURITY;

-- Políticas para staff (acesso total via projeto)
CREATE POLICY "Staff can view assessment cycles" ON public.assessment_cycles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Staff can manage assessment cycles" ON public.assessment_cycles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Staff can view participants" ON public.assessment_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Staff can manage participants" ON public.assessment_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Staff can view DISC responses" ON public.disc_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Anyone can insert DISC responses" ON public.disc_responses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can view 360 evaluations" ON public.assessment_360_evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

CREATE POLICY "Anyone can insert 360 evaluations" ON public.assessment_360_evaluations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update own 360 evaluations" ON public.assessment_360_evaluations
  FOR UPDATE USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_assessment_cycles_updated_at
  BEFORE UPDATE ON public.assessment_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();