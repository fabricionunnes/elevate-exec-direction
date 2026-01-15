-- 1. Tabela de Análise de Sentimento em Reuniões
CREATE TABLE public.meeting_sentiment_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.onboarding_meeting_notes(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  overall_sentiment TEXT CHECK (overall_sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score NUMERIC(3,2),
  key_emotions JSONB DEFAULT '{}',
  concern_keywords TEXT[] DEFAULT '{}',
  positive_keywords TEXT[] DEFAULT '{}',
  summary TEXT,
  ai_insights TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Score de Engajamento do Consultor
CREATE TABLE public.consultant_engagement_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  calculation_date DATE DEFAULT CURRENT_DATE,
  period_start DATE,
  period_end DATE,
  meeting_score NUMERIC(5,2) DEFAULT 0,
  task_score NUMERIC(5,2) DEFAULT 0,
  response_score NUMERIC(5,2) DEFAULT 0,
  retention_score NUMERIC(5,2) DEFAULT 0,
  nps_score NUMERIC(5,2) DEFAULT 0,
  total_score NUMERIC(5,2) DEFAULT 0,
  rank_position INTEGER,
  metrics_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, calculation_date)
);

-- 3. Tabela de Playbooks de Resgate
CREATE TABLE public.rescue_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  churn_prediction_id UUID REFERENCES public.churn_predictions(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  triggered_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  strategy_summary TEXT,
  ai_recommendations TEXT,
  tasks_created INTEGER DEFAULT 0,
  notifications_sent JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de Briefings de Reunião
CREATE TABLE public.meeting_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.onboarding_meeting_notes(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  executive_summary TEXT,
  client_history TEXT,
  pending_items TEXT,
  goal_status TEXT,
  attention_points TEXT,
  suggested_agenda TEXT,
  talking_points TEXT[] DEFAULT '{}',
  health_score_at_generation NUMERIC,
  churn_risk_at_generation TEXT,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_sentiment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_engagement_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rescue_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_briefings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_sentiment_analysis
CREATE POLICY "Staff can view sentiment analysis" ON public.meeting_sentiment_analysis
  FOR SELECT USING (true);

CREATE POLICY "Staff can insert sentiment analysis" ON public.meeting_sentiment_analysis
  FOR INSERT WITH CHECK (true);

-- RLS Policies for consultant_engagement_scores
CREATE POLICY "Staff can view engagement scores" ON public.consultant_engagement_scores
  FOR SELECT USING (true);

CREATE POLICY "System can insert engagement scores" ON public.consultant_engagement_scores
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update engagement scores" ON public.consultant_engagement_scores
  FOR UPDATE USING (true);

-- RLS Policies for rescue_playbooks
CREATE POLICY "Staff can view rescue playbooks" ON public.rescue_playbooks
  FOR SELECT USING (true);

CREATE POLICY "System can insert rescue playbooks" ON public.rescue_playbooks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update rescue playbooks" ON public.rescue_playbooks
  FOR UPDATE USING (true);

-- RLS Policies for meeting_briefings
CREATE POLICY "Staff can view meeting briefings" ON public.meeting_briefings
  FOR SELECT USING (true);

CREATE POLICY "System can insert meeting briefings" ON public.meeting_briefings
  FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_sentiment_meeting ON public.meeting_sentiment_analysis(meeting_id);
CREATE INDEX idx_sentiment_project ON public.meeting_sentiment_analysis(project_id);
CREATE INDEX idx_engagement_staff ON public.consultant_engagement_scores(staff_id);
CREATE INDEX idx_engagement_date ON public.consultant_engagement_scores(calculation_date);
CREATE INDEX idx_playbook_project ON public.rescue_playbooks(project_id);
CREATE INDEX idx_playbook_status ON public.rescue_playbooks(status);
CREATE INDEX idx_briefing_meeting ON public.meeting_briefings(meeting_id);
CREATE INDEX idx_briefing_project ON public.meeting_briefings(project_id);