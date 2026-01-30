-- Create table for CRM staff goals/targets
CREATE TABLE public.crm_staff_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  
  -- Sales goals (for Closers)
  meta_vendas NUMERIC DEFAULT 0,
  super_meta_vendas NUMERIC DEFAULT 0,
  hiper_meta_vendas NUMERIC DEFAULT 0,
  
  -- Scheduling goals (for SDR and Social Setter)
  meta_agendamentos INTEGER DEFAULT 0,
  super_meta_agendamentos INTEGER DEFAULT 0,
  hiper_meta_agendamentos INTEGER DEFAULT 0,
  
  -- Meeting goals (for SDR and Social Setter)
  meta_reunioes INTEGER DEFAULT 0,
  super_meta_reunioes INTEGER DEFAULT 0,
  hiper_meta_reunioes INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint: one record per staff per month/year
  CONSTRAINT unique_staff_month_year UNIQUE (staff_id, month, year)
);

-- Enable RLS
ALTER TABLE public.crm_staff_goals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff with CRM access can view goals"
ON public.crm_staff_goals
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage goals"
ON public.crm_staff_goals
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role IN ('master', 'admin', 'head_comercial')
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_crm_staff_goals_updated_at
BEFORE UPDATE ON public.crm_staff_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_crm_staff_goals_staff_month_year ON public.crm_staff_goals(staff_id, year, month);