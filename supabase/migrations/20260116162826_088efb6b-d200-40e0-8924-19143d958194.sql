
-- Tabela para critérios de scorecard de entrevista
CREATE TABLE public.interview_scorecard_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  job_opening_id UUID REFERENCES job_openings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  weight INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para pontuações do scorecard
CREATE TABLE public.interview_scorecard_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  criteria_id UUID REFERENCES interview_scorecard_criteria(id) ON DELETE CASCADE,
  score INTEGER CHECK (score >= 1 AND score <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(interview_id, criteria_id)
);

-- Tabela para tags de talentos
CREATE TABLE public.talent_pool_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  category TEXT DEFAULT 'skill', -- skill, disc, custom
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Tabela de relacionamento candidato-tag
CREATE TABLE public.candidate_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES talent_pool_tags(id) ON DELETE CASCADE,
  added_by UUID REFERENCES onboarding_staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(candidate_id, tag_id)
);

-- Adicionar campos ao candidato para banco de talentos
ALTER TABLE public.candidates 
  ADD COLUMN IF NOT EXISTS talent_pool_notes TEXT,
  ADD COLUMN IF NOT EXISTS talent_pool_added_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expected_salary_range TEXT,
  ADD COLUMN IF NOT EXISTS availability_date DATE,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_match_score NUMERIC(5,2);

-- Enable RLS
ALTER TABLE public.interview_scorecard_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scorecard_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_pool_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interview_scorecard_criteria
CREATE POLICY "Staff can view scorecard criteria" ON public.interview_scorecard_criteria
  FOR SELECT USING (true);

CREATE POLICY "Staff can manage scorecard criteria" ON public.interview_scorecard_criteria
  FOR ALL USING (true);

-- RLS Policies for interview_scorecard_scores
CREATE POLICY "Staff can view scorecard scores" ON public.interview_scorecard_scores
  FOR SELECT USING (true);

CREATE POLICY "Staff can manage scorecard scores" ON public.interview_scorecard_scores
  FOR ALL USING (true);

-- RLS Policies for talent_pool_tags
CREATE POLICY "Staff can view talent pool tags" ON public.talent_pool_tags
  FOR SELECT USING (true);

CREATE POLICY "Staff can manage talent pool tags" ON public.talent_pool_tags
  FOR ALL USING (true);

-- RLS Policies for candidate_tags
CREATE POLICY "Staff can view candidate tags" ON public.candidate_tags
  FOR SELECT USING (true);

CREATE POLICY "Staff can manage candidate tags" ON public.candidate_tags
  FOR ALL USING (true);

-- Trigger for updated_at on interview_scorecard_criteria
CREATE TRIGGER update_interview_scorecard_criteria_updated_at
  BEFORE UPDATE ON public.interview_scorecard_criteria
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_scorecard_criteria;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_scorecard_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.talent_pool_tags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_tags;
