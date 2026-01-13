-- Create origin groups table
CREATE TABLE public.crm_origin_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create origins table
CREATE TABLE public.crm_origins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  group_id UUID REFERENCES public.crm_origin_groups(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add origin_id to leads
ALTER TABLE public.crm_leads ADD COLUMN origin_id UUID REFERENCES public.crm_origins(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.crm_origin_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_origins ENABLE ROW LEVEL SECURITY;

-- RLS policies for origin groups
CREATE POLICY "Staff can view origin groups" ON public.crm_origin_groups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admin and head can manage origin groups" ON public.crm_origin_groups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'head_comercial'))
  );

-- RLS policies for origins
CREATE POLICY "Staff can view origins" ON public.crm_origins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admin and head can manage origins" ON public.crm_origins
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'head_comercial'))
  );

-- Insert default origin groups
INSERT INTO public.crm_origin_groups (name, icon, sort_order) VALUES
  ('Funis Comerciais', 'target', 1),
  ('Funis de Marketing', 'megaphone', 2),
  ('Funis de Venda', 'shopping-cart', 3);