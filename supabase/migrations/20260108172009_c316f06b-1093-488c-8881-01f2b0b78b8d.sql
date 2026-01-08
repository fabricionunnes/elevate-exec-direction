
-- Table for configurable weights per company/project
CREATE TABLE public.health_score_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  satisfaction_weight NUMERIC DEFAULT 25,
  goals_weight NUMERIC DEFAULT 25,
  commercial_weight NUMERIC DEFAULT 20,
  engagement_weight NUMERIC DEFAULT 15,
  support_weight NUMERIC DEFAULT 10,
  trend_weight NUMERIC DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

-- Main health score table
CREATE TABLE public.client_health_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  total_score NUMERIC NOT NULL DEFAULT 0,
  satisfaction_score NUMERIC DEFAULT 0,
  goals_score NUMERIC DEFAULT 0,
  commercial_score NUMERIC DEFAULT 0,
  engagement_score NUMERIC DEFAULT 0,
  support_score NUMERIC DEFAULT 0,
  trend_score NUMERIC DEFAULT 0,
  risk_level TEXT DEFAULT 'healthy',
  trend_direction TEXT DEFAULT 'stable',
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

-- Daily snapshots for history
CREATE TABLE public.health_score_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_score NUMERIC NOT NULL,
  satisfaction_score NUMERIC,
  goals_score NUMERIC,
  commercial_score NUMERIC,
  engagement_score NUMERIC,
  support_score NUMERIC,
  trend_score NUMERIC,
  risk_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, snapshot_date)
);

-- Manual observations
CREATE TABLE public.health_score_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.onboarding_staff(id),
  observation TEXT NOT NULL,
  observation_type TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Event logs for audit
CREATE TABLE public.health_score_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  previous_score NUMERIC,
  new_score NUMERIC,
  triggered_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.health_score_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_score_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_score_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view health scores" ON public.client_health_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage health scores" ON public.client_health_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Staff can view weights" ON public.health_score_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage weights" ON public.health_score_weights FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Staff can view snapshots" ON public.health_score_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage snapshots" ON public.health_score_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Staff can view observations" ON public.health_score_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage observations" ON public.health_score_observations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Staff can view events" ON public.health_score_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage events" ON public.health_score_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_health_scores_project ON public.client_health_scores(project_id);
CREATE INDEX idx_health_snapshots_project_date ON public.health_score_snapshots(project_id, snapshot_date);
CREATE INDEX idx_health_observations_project ON public.health_score_observations(project_id);
CREATE INDEX idx_health_events_project ON public.health_score_events(project_id);
