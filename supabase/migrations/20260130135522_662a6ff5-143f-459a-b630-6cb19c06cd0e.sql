-- Table for CRM products/services that can be sold
CREATE TABLE public.crm_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table for tracking sales targets/goals
CREATE TABLE public.crm_sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.onboarding_staff(id),
  target_type TEXT NOT NULL DEFAULT 'revenue', -- 'revenue', 'calls', 'meetings', 'sales_qty'
  target_value NUMERIC NOT NULL DEFAULT 0,
  super_target NUMERIC DEFAULT 0, -- Super meta
  hyper_target NUMERIC DEFAULT 0, -- Hiper meta
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, target_type, month, year)
);

-- Table for tracking daily activities/approaches from SDR/SS
CREATE TABLE public.crm_daily_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.onboarding_staff(id) NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  approaches INTEGER DEFAULT 0, -- Abordagens/Ligações
  connections INTEGER DEFAULT 0, -- Conexões
  scheduled INTEGER DEFAULT 0, -- Agendamentos
  qualifications INTEGER DEFAULT 0, -- Qualificações
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, activity_date)
);

-- Table for tracking meetings/calls scheduled
CREATE TABLE public.crm_scheduled_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  scheduled_by UUID REFERENCES public.onboarding_staff(id), -- SDR/SS who scheduled
  assigned_to UUID REFERENCES public.onboarding_staff(id), -- Closer who will attend
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'no_show', 'cancelled', 'rescheduled'
  reschedule_count INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  no_show_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table for tracking sales/deals closed
CREATE TABLE public.crm_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.crm_leads(id),
  closer_staff_id UUID REFERENCES public.onboarding_staff(id), -- Closer
  sdr_staff_id UUID REFERENCES public.onboarding_staff(id), -- SDR/SS/BDR who originated
  pipeline_id UUID REFERENCES public.crm_pipelines(id),
  product_id UUID REFERENCES public.crm_products(id),
  product_name TEXT, -- Fallback if product not linked
  billing_value NUMERIC DEFAULT 0, -- Faturamento
  revenue_value NUMERIC NOT NULL DEFAULT 0, -- Receita
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'awaiting_payment', 'cancelled'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table for tracking forecasts (deals in progress)
CREATE TABLE public.crm_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  closer_staff_id UUID REFERENCES public.onboarding_staff(id),
  product_name TEXT,
  forecast_value NUMERIC NOT NULL DEFAULT 0,
  expected_close_date DATE,
  status TEXT DEFAULT 'open', -- 'open', 'won', 'lost'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add sdr_staff_id to crm_leads to track who originated the lead
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS sdr_staff_id UUID REFERENCES public.onboarding_staff(id);

-- Enable RLS
ALTER TABLE public.crm_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_daily_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_scheduled_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow authenticated users
CREATE POLICY "Authenticated can view products" ON public.crm_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage products" ON public.crm_products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view targets" ON public.crm_sales_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage targets" ON public.crm_sales_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view daily activities" ON public.crm_daily_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage daily activities" ON public.crm_daily_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view scheduled calls" ON public.crm_scheduled_calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage scheduled calls" ON public.crm_scheduled_calls FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view sales" ON public.crm_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage sales" ON public.crm_sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view forecasts" ON public.crm_forecasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage forecasts" ON public.crm_forecasts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert some default products
INSERT INTO public.crm_products (name, price, sort_order) VALUES
('UNV Core', 1997, 1),
('UNV Social', 2000, 2),
('UNV Control', 5900, 3),
('UNV Sales Acceleration', 2000, 4),
('PROGRAMA SIRIUS', 4500, 5);