-- Create table for monthly goals and results tracking
CREATE TABLE public.onboarding_monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  sales_target NUMERIC DEFAULT NULL,
  sales_result NUMERIC DEFAULT NULL,
  target_set_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  result_set_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  target_set_by UUID REFERENCES public.onboarding_staff(id) DEFAULT NULL,
  result_set_by UUID REFERENCES public.onboarding_staff(id) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, month, year)
);

-- Enable RLS
ALTER TABLE public.onboarding_monthly_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Project members can view monthly goals"
ON public.onboarding_monthly_goals
FOR SELECT
USING (
  is_onboarding_project_member(project_id) OR 
  is_onboarding_admin() OR 
  is_onboarding_assigned_staff(project_id)
);

CREATE POLICY "Staff can manage monthly goals"
ON public.onboarding_monthly_goals
FOR ALL
USING (
  is_onboarding_admin() OR 
  is_onboarding_assigned_staff(project_id)
);

-- Create index for faster queries
CREATE INDEX idx_monthly_goals_project_month_year ON public.onboarding_monthly_goals(project_id, year, month);