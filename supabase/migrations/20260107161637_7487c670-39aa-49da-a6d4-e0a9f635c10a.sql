-- Create endomarketing campaigns table
CREATE TABLE public.endomarketing_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  kpi_id UUID NOT NULL REFERENCES public.company_kpis(id) ON DELETE RESTRICT,
  calculation_method TEXT NOT NULL DEFAULT 'sum' CHECK (calculation_method IN ('sum', 'avg', 'max')),
  tiebreaker TEXT DEFAULT 'sales_count' CHECK (tiebreaker IN ('sales_count', 'avg_ticket', 'first_to_goal', 'manual')),
  competition_type TEXT NOT NULL DEFAULT 'individual' CHECK (competition_type IN ('individual', 'team')),
  has_goal BOOLEAN NOT NULL DEFAULT false,
  goal_value NUMERIC,
  goal_type TEXT DEFAULT 'general' CHECK (goal_type IN ('general', 'individual', 'both')),
  has_prizes BOOLEAN NOT NULL DEFAULT false,
  prize_model TEXT DEFAULT 'first' CHECK (prize_model IN ('first', 'top3', 'topN', 'tiers', 'goal_achieved')),
  prize_top_n INTEGER,
  all_salespeople BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.onboarding_staff(id),
  ended_manually_at TIMESTAMP WITH TIME ZONE,
  ended_manually_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaign participants table
CREATE TABLE public.endomarketing_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.endomarketing_campaigns(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL REFERENCES public.company_salespeople(id) ON DELETE CASCADE,
  team_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, salesperson_id)
);

-- Create campaign teams table (for team competitions)
CREATE TABLE public.endomarketing_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.endomarketing_campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key for team_id after teams table exists
ALTER TABLE public.endomarketing_participants 
ADD CONSTRAINT endomarketing_participants_team_id_fkey 
FOREIGN KEY (team_id) REFERENCES public.endomarketing_teams(id) ON DELETE SET NULL;

-- Create campaign prizes table
CREATE TABLE public.endomarketing_prizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.endomarketing_campaigns(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  prize_type TEXT NOT NULL DEFAULT 'other' CHECK (prize_type IN ('money', 'product', 'experience', 'other')),
  value NUMERIC,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaign snapshots table (final results when campaign ends)
CREATE TABLE public.endomarketing_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.endomarketing_campaigns(id) ON DELETE CASCADE,
  salesperson_id UUID REFERENCES public.company_salespeople(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.endomarketing_teams(id) ON DELETE SET NULL,
  final_position INTEGER NOT NULL,
  final_value NUMERIC NOT NULL,
  goal_percentage NUMERIC,
  prize_id UUID REFERENCES public.endomarketing_prizes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, salesperson_id),
  UNIQUE(campaign_id, team_id)
);

-- Enable RLS
ALTER TABLE public.endomarketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endomarketing_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endomarketing_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endomarketing_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endomarketing_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns
CREATE POLICY "Staff can view campaigns" ON public.endomarketing_campaigns
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Staff can manage campaigns" ON public.endomarketing_campaigns
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'consultant')
  )
);

CREATE POLICY "Users can view their project campaigns" ON public.endomarketing_campaigns
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid() AND ou.project_id = endomarketing_campaigns.project_id
  )
);

-- RLS Policies for participants
CREATE POLICY "Staff can view participants" ON public.endomarketing_participants
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Staff can manage participants" ON public.endomarketing_participants
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'consultant')
  )
);

CREATE POLICY "Users can view campaign participants" ON public.endomarketing_participants
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.endomarketing_campaigns c
    JOIN public.onboarding_users ou ON ou.project_id = c.project_id
    WHERE c.id = endomarketing_participants.campaign_id AND ou.user_id = auth.uid()
  )
);

-- RLS Policies for teams
CREATE POLICY "Staff can view teams" ON public.endomarketing_teams
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Staff can manage teams" ON public.endomarketing_teams
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'consultant')
  )
);

CREATE POLICY "Users can view campaign teams" ON public.endomarketing_teams
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.endomarketing_campaigns c
    JOIN public.onboarding_users ou ON ou.project_id = c.project_id
    WHERE c.id = endomarketing_teams.campaign_id AND ou.user_id = auth.uid()
  )
);

-- RLS Policies for prizes
CREATE POLICY "Staff can view prizes" ON public.endomarketing_prizes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Staff can manage prizes" ON public.endomarketing_prizes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'consultant')
  )
);

CREATE POLICY "Users can view campaign prizes" ON public.endomarketing_prizes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.endomarketing_campaigns c
    JOIN public.onboarding_users ou ON ou.project_id = c.project_id
    WHERE c.id = endomarketing_prizes.campaign_id AND ou.user_id = auth.uid()
  )
);

-- RLS Policies for snapshots
CREATE POLICY "Staff can view snapshots" ON public.endomarketing_snapshots
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Staff can manage snapshots" ON public.endomarketing_snapshots
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'consultant')
  )
);

CREATE POLICY "Users can view campaign snapshots" ON public.endomarketing_snapshots
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.endomarketing_campaigns c
    JOIN public.onboarding_users ou ON ou.project_id = c.project_id
    WHERE c.id = endomarketing_snapshots.campaign_id AND ou.user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_endomarketing_campaigns_company ON public.endomarketing_campaigns(company_id);
CREATE INDEX idx_endomarketing_campaigns_project ON public.endomarketing_campaigns(project_id);
CREATE INDEX idx_endomarketing_campaigns_status ON public.endomarketing_campaigns(status);
CREATE INDEX idx_endomarketing_campaigns_dates ON public.endomarketing_campaigns(start_date, end_date);
CREATE INDEX idx_endomarketing_participants_campaign ON public.endomarketing_participants(campaign_id);
CREATE INDEX idx_endomarketing_participants_salesperson ON public.endomarketing_participants(salesperson_id);
CREATE INDEX idx_endomarketing_prizes_campaign ON public.endomarketing_prizes(campaign_id);
CREATE INDEX idx_endomarketing_snapshots_campaign ON public.endomarketing_snapshots(campaign_id);

-- Create trigger for updated_at
CREATE TRIGGER update_endomarketing_campaigns_updated_at
BEFORE UPDATE ON public.endomarketing_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();