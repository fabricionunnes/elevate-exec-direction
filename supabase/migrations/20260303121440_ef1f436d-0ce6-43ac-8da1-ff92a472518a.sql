
-- Balloon campaigns configuration
CREATE TABLE public.endomarketing_balloon_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Goal configuration
  goal_type TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, biweekly, monthly, custom
  goal_source TEXT NOT NULL DEFAULT 'kpi', -- kpi, manual
  kpi_id UUID REFERENCES public.company_kpis(id),
  goal_value NUMERIC,
  
  -- Balloon mechanics
  balloons_per_achievement INT NOT NULL DEFAULT 3,
  max_balloons_per_period INT, -- null = unlimited
  
  -- Prize distribution mode
  prize_mode TEXT NOT NULL DEFAULT 'weighted', -- weighted, equal, fixed_pool
  
  -- Visual customization
  balloon_colors TEXT[] DEFAULT ARRAY['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899'],
  
  -- Targeting
  all_salespeople BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.onboarding_staff(id)
);

-- Balloon prizes configuration
CREATE TABLE public.endomarketing_balloon_prizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.endomarketing_balloon_campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '🎁',
  prize_type TEXT NOT NULL DEFAULT 'physical', -- physical, bonus, message, try_again
  value NUMERIC, -- monetary value if applicable
  weight INT NOT NULL DEFAULT 1, -- for weighted mode
  total_quantity INT, -- null = unlimited, for fixed_pool mode
  quantity_remaining INT, -- tracks remaining for fixed_pool
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Balloon participants (if not all_salespeople)
CREATE TABLE public.endomarketing_balloon_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.endomarketing_balloon_campaigns(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, salesperson_id)
);

-- Record of balloon pops
CREATE TABLE public.endomarketing_balloon_pops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.endomarketing_balloon_campaigns(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL,
  salesperson_name TEXT NOT NULL,
  prize_id UUID REFERENCES public.endomarketing_balloon_prizes(id),
  prize_name TEXT NOT NULL,
  prize_type TEXT NOT NULL,
  period_key TEXT NOT NULL, -- e.g. '2026-03-03' for daily, '2026-W10' for weekly, etc.
  goal_value_achieved NUMERIC,
  popped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered BOOLEAN NOT NULL DEFAULT false,
  delivered_at TIMESTAMPTZ,
  delivered_by UUID REFERENCES public.onboarding_staff(id)
);

-- Pending balloon achievements (earned but not yet popped)
CREATE TABLE public.endomarketing_balloon_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.endomarketing_balloon_campaigns(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL,
  salesperson_name TEXT NOT NULL,
  period_key TEXT NOT NULL,
  balloons_earned INT NOT NULL DEFAULT 0,
  balloons_popped INT NOT NULL DEFAULT 0,
  goal_value NUMERIC,
  achieved_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, salesperson_id, period_key)
);

-- Enable RLS
ALTER TABLE public.endomarketing_balloon_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endomarketing_balloon_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endomarketing_balloon_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endomarketing_balloon_pops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endomarketing_balloon_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Staff can manage
CREATE POLICY "Staff can view balloon campaigns" ON public.endomarketing_balloon_campaigns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert balloon campaigns" ON public.endomarketing_balloon_campaigns
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Staff can update balloon campaigns" ON public.endomarketing_balloon_campaigns
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Staff can delete balloon campaigns" ON public.endomarketing_balloon_campaigns
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'master'))
  );

-- Prizes
CREATE POLICY "Anyone can view balloon prizes" ON public.endomarketing_balloon_prizes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage balloon prizes" ON public.endomarketing_balloon_prizes
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

-- Participants
CREATE POLICY "Anyone can view balloon participants" ON public.endomarketing_balloon_participants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage balloon participants" ON public.endomarketing_balloon_participants
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

-- Pops
CREATE POLICY "Anyone can view balloon pops" ON public.endomarketing_balloon_pops
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can insert balloon pops" ON public.endomarketing_balloon_pops
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can update balloon pops" ON public.endomarketing_balloon_pops
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

-- Achievements
CREATE POLICY "Anyone can view balloon achievements" ON public.endomarketing_balloon_achievements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can manage balloon achievements" ON public.endomarketing_balloon_achievements
  FOR ALL TO authenticated USING (true);

-- Indexes
CREATE INDEX idx_balloon_campaigns_project ON public.endomarketing_balloon_campaigns(project_id);
CREATE INDEX idx_balloon_prizes_campaign ON public.endomarketing_balloon_prizes(campaign_id);
CREATE INDEX idx_balloon_pops_campaign ON public.endomarketing_balloon_pops(campaign_id);
CREATE INDEX idx_balloon_pops_salesperson ON public.endomarketing_balloon_pops(salesperson_id);
CREATE INDEX idx_balloon_achievements_campaign ON public.endomarketing_balloon_achievements(campaign_id);
CREATE INDEX idx_balloon_achievements_salesperson ON public.endomarketing_balloon_achievements(salesperson_id);
