
-- Gamification Configuration per project
CREATE TABLE public.gamification_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  season_type TEXT DEFAULT 'monthly' CHECK (season_type IN ('weekly', 'monthly', 'quarterly')),
  reset_points_on_season_end BOOLEAN DEFAULT false,
  team_mode_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

-- Scoring Rules
CREATE TABLE public.gamification_scoring_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.gamification_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('per_unit', 'per_value', 'goal_achieved', 'streak')),
  kpi_id UUID REFERENCES public.company_kpis(id) ON DELETE SET NULL,
  event_type TEXT,
  points_value INTEGER NOT NULL DEFAULT 0,
  points_per_unit NUMERIC(10,2),
  streak_days INTEGER,
  streak_bonus INTEGER,
  max_points_per_day INTEGER,
  max_points_per_week INTEGER,
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Seasons (Temporadas)
CREATE TABLE public.gamification_seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.gamification_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended')),
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Teams (optional team mode)
CREATE TABLE public.gamification_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.gamification_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Team Members
CREATE TABLE public.gamification_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.gamification_teams(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL REFERENCES public.company_salespeople(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, salesperson_id)
);

-- Participants
CREATE TABLE public.gamification_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.gamification_configs(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL REFERENCES public.company_salespeople(id) ON DELETE CASCADE,
  current_level INTEGER DEFAULT 1,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(config_id, salesperson_id)
);

-- Badges
CREATE TABLE public.gamification_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.gamification_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'trophy',
  condition_type TEXT NOT NULL CHECK (condition_type IN ('first_sale', 'top_rank', 'streak', 'points_threshold', 'mission_complete', 'custom')),
  condition_value INTEGER,
  condition_kpi_id UUID REFERENCES public.company_kpis(id) ON DELETE SET NULL,
  is_repeatable BOOLEAN DEFAULT false,
  show_on_profile BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User Badges (earned)
CREATE TABLE public.gamification_user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  badge_id UUID NOT NULL REFERENCES public.gamification_badges(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.gamification_participants(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.gamification_seasons(id) ON DELETE SET NULL,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Missions
CREATE TABLE public.gamification_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.gamification_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  mission_type TEXT DEFAULT 'individual' CHECK (mission_type IN ('individual', 'team')),
  metric_kpi_id UUID REFERENCES public.company_kpis(id) ON DELETE SET NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('reach_value', 'streak', 'top_rank')),
  condition_value INTEGER NOT NULL,
  season_id UUID REFERENCES public.gamification_seasons(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  reward_points INTEGER DEFAULT 0,
  reward_badge_id UUID REFERENCES public.gamification_badges(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Mission Progress
CREATE TABLE public.gamification_mission_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES public.gamification_missions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.gamification_participants(id) ON DELETE CASCADE,
  current_value NUMERIC(15,2) DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(mission_id, participant_id)
);

-- Rewards (Prêmios)
CREATE TABLE public.gamification_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.gamification_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('money', 'product', 'experience', 'other')),
  value NUMERIC(10,2),
  condition_type TEXT NOT NULL CHECK (condition_type IN ('rank_position', 'goal_achieved', 'mission_complete')),
  condition_value INTEGER,
  mission_id UUID REFERENCES public.gamification_missions(id) ON DELETE SET NULL,
  season_id UUID REFERENCES public.gamification_seasons(id) ON DELETE SET NULL,
  show_on_dashboard BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Score Logs (audit trail)
CREATE TABLE public.gamification_score_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID NOT NULL REFERENCES public.gamification_participants(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.gamification_seasons(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES public.gamification_scoring_rules(id) ON DELETE SET NULL,
  mission_id UUID REFERENCES public.gamification_missions(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT,
  source_id UUID,
  entry_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Leaderboard Snapshots (final rankings)
CREATE TABLE public.gamification_leaderboard_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.gamification_seasons(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.gamification_participants(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.gamification_teams(id) ON DELETE SET NULL,
  final_position INTEGER NOT NULL,
  final_points INTEGER NOT NULL,
  reward_id UUID REFERENCES public.gamification_rewards(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Levels configuration
CREATE TABLE public.gamification_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.gamification_configs(id) ON DELETE CASCADE,
  level_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL,
  icon TEXT DEFAULT 'star',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(config_id, level_number)
);

-- Enable RLS on all tables
ALTER TABLE public.gamification_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_mission_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_score_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_levels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for all gamification tables (allowing authenticated users)
CREATE POLICY "Allow all for authenticated" ON public.gamification_configs FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_scoring_rules FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_seasons FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_teams FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_team_members FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_participants FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_badges FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_user_badges FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_missions FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_mission_progress FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_rewards FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_score_logs FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_leaderboard_snapshots FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.gamification_levels FOR ALL USING (true);

-- Add indexes for performance
CREATE INDEX idx_gamification_configs_project ON public.gamification_configs(project_id);
CREATE INDEX idx_gamification_scoring_rules_config ON public.gamification_scoring_rules(config_id);
CREATE INDEX idx_gamification_seasons_config ON public.gamification_seasons(config_id);
CREATE INDEX idx_gamification_score_logs_participant ON public.gamification_score_logs(participant_id);
CREATE INDEX idx_gamification_score_logs_date ON public.gamification_score_logs(entry_date);
CREATE INDEX idx_gamification_participants_config ON public.gamification_participants(config_id);
CREATE INDEX idx_gamification_missions_config ON public.gamification_missions(config_id);
