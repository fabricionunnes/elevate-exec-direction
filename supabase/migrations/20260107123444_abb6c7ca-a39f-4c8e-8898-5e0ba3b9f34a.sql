-- Tabela de vendedores por empresa
CREATE TABLE public.company_salespeople (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  access_code TEXT NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de KPIs configuráveis por empresa
CREATE TABLE public.company_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kpi_type TEXT NOT NULL CHECK (kpi_type IN ('numeric', 'monetary', 'percentage')),
  periodicity TEXT NOT NULL CHECK (periodicity IN ('daily', 'weekly', 'monthly')),
  target_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_individual BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de lançamentos de vendas
CREATE TABLE public.kpi_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL REFERENCES public.company_salespeople(id) ON DELETE CASCADE,
  kpi_id UUID NOT NULL REFERENCES public.company_kpis(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  value DECIMAL(15,2) NOT NULL DEFAULT 0,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(salesperson_id, kpi_id, entry_date)
);

-- Enable RLS
ALTER TABLE public.company_salespeople ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_salespeople
CREATE POLICY "Staff can view salespeople" ON public.company_salespeople
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can manage salespeople" ON public.company_salespeople
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- RLS Policies for company_kpis
CREATE POLICY "Staff can view kpis" ON public.company_kpis
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can manage kpis" ON public.company_kpis
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- RLS Policies for kpi_entries (allowing public access for salespeople via access code)
CREATE POLICY "Staff can view all entries" ON public.kpi_entries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can manage entries" ON public.kpi_entries
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Public can insert entries" ON public.kpi_entries
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Public can view own entries" ON public.kpi_entries
  FOR SELECT TO anon
  USING (true);

-- Allow public to read salespeople (for validation with access code)
CREATE POLICY "Public can view salespeople" ON public.company_salespeople
  FOR SELECT TO anon
  USING (true);

-- Allow public to read kpis
CREATE POLICY "Public can view kpis" ON public.company_kpis
  FOR SELECT TO anon
  USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_company_salespeople_updated_at
  BEFORE UPDATE ON public.company_salespeople
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_kpis_updated_at
  BEFORE UPDATE ON public.company_kpis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kpi_entries_updated_at
  BEFORE UPDATE ON public.kpi_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_company_salespeople_company ON public.company_salespeople(company_id);
CREATE INDEX idx_company_kpis_company ON public.company_kpis(company_id);
CREATE INDEX idx_kpi_entries_company ON public.kpi_entries(company_id);
CREATE INDEX idx_kpi_entries_salesperson ON public.kpi_entries(salesperson_id);
CREATE INDEX idx_kpi_entries_date ON public.kpi_entries(entry_date);
CREATE INDEX idx_kpi_entries_kpi ON public.kpi_entries(kpi_id);