
-- Commission config per salesperson per project
CREATE TABLE public.sf_commission_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'closer' CHECK (role IN ('sdr', 'closer')),
  base_salary NUMERIC NOT NULL DEFAULT 0,
  client_pays_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, salesperson_id)
);

-- Commission tiers per config
CREATE TABLE public.sf_commission_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.sf_commission_configs(id) ON DELETE CASCADE,
  min_percent NUMERIC NOT NULL DEFAULT 0,
  max_percent NUMERIC,
  commission_type TEXT NOT NULL DEFAULT 'fixed' CHECK (commission_type IN ('fixed', 'percent')),
  commission_value NUMERIC NOT NULL DEFAULT 0,
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sf_commission_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_commission_tiers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view sf_commission_configs"
ON public.sf_commission_configs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sf_commission_configs"
ON public.sf_commission_configs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sf_commission_configs"
ON public.sf_commission_configs FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete sf_commission_configs"
ON public.sf_commission_configs FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view sf_commission_tiers"
ON public.sf_commission_tiers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sf_commission_tiers"
ON public.sf_commission_tiers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sf_commission_tiers"
ON public.sf_commission_tiers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete sf_commission_tiers"
ON public.sf_commission_tiers FOR DELETE TO authenticated USING (true);

-- Updated_at trigger
CREATE TRIGGER update_sf_commission_configs_updated_at
BEFORE UPDATE ON public.sf_commission_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
