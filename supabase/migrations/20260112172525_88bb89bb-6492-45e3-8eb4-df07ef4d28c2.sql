-- Create company_teams table for team management
CREATE TABLE public.company_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.company_units(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add team_id to company_salespeople
ALTER TABLE public.company_salespeople 
ADD COLUMN team_id UUID REFERENCES public.company_teams(id) ON DELETE SET NULL;

-- Add team_id to kpi_entries
ALTER TABLE public.kpi_entries 
ADD COLUMN team_id UUID REFERENCES public.company_teams(id) ON DELETE SET NULL;

-- Add team_id to kpi_monthly_targets
ALTER TABLE public.kpi_monthly_targets 
ADD COLUMN team_id UUID REFERENCES public.company_teams(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_company_teams_company_id ON public.company_teams(company_id);
CREATE INDEX idx_company_teams_unit_id ON public.company_teams(unit_id);
CREATE INDEX idx_company_teams_is_active ON public.company_teams(is_active);
CREATE INDEX idx_company_salespeople_team_id ON public.company_salespeople(team_id);
CREATE INDEX idx_kpi_entries_team_id ON public.kpi_entries(team_id);
CREATE INDEX idx_kpi_monthly_targets_team_id ON public.kpi_monthly_targets(team_id);

-- Enable RLS
ALTER TABLE public.company_teams ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_teams
CREATE POLICY "Staff can view all teams"
ON public.company_teams
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Staff can insert teams"
ON public.company_teams
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Staff can update teams"
ON public.company_teams
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Staff can delete teams"
ON public.company_teams
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_company_teams_updated_at
BEFORE UPDATE ON public.company_teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for company_teams
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_teams;