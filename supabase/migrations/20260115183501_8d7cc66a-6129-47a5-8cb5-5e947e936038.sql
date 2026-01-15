
-- ================================================
-- MÓDULO: PONTUAÇÃO DE CLIENTES (Customer Points)
-- ================================================

-- 1) Configurações gerais por empresa
CREATE TABLE public.customer_points_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  points_name VARCHAR(50) DEFAULT 'Pontos',
  is_active BOOLEAN DEFAULT true,
  levels_enabled BOOLEAN DEFAULT false,
  levels_config JSONB DEFAULT '[]'::jsonb,
  rewards_enabled BOOLEAN DEFAULT false,
  rewards_config JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- 2) Clientes finais (com CPF único por empresa)
CREATE TABLE public.customer_points_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  cpf VARCHAR(14) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  birth_date DATE,
  notes TEXT,
  total_points INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, cpf)
);

-- 3) Regras de pontuação
CREATE TABLE public.customer_points_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  rule_type VARCHAR(30) NOT NULL CHECK (rule_type IN ('fixed', 'per_value', 'per_quantity', 'streak')),
  points_value INTEGER DEFAULT 0,
  multiplier DECIMAL(10,2) DEFAULT 1,
  min_value DECIMAL(10,2),
  max_points_per_action INTEGER,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4) Transações de pontos (log)
CREATE TABLE public.customer_points_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.customer_points_clients(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.customer_points_rules(id) ON DELETE SET NULL,
  cpf VARCHAR(14) NOT NULL,
  points INTEGER NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('manual', 'qr_code')),
  reference_value DECIMAL(10,2),
  reference_quantity INTEGER,
  qr_campaign_id UUID,
  form_responses JSONB,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5) Campanhas de QR Code
CREATE TABLE public.customer_points_qr_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  rule_id UUID REFERENCES public.customer_points_rules(id) ON DELETE SET NULL,
  access_token VARCHAR(64) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  form_fields JSONB DEFAULT '[]'::jsonb,
  limit_per_cpf_per_day INTEGER DEFAULT 1,
  limit_per_cpf_total INTEGER,
  min_hours_between INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  total_scans INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key for qr_campaign_id in transactions
ALTER TABLE public.customer_points_transactions 
ADD CONSTRAINT fk_qr_campaign 
FOREIGN KEY (qr_campaign_id) REFERENCES public.customer_points_qr_campaigns(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX idx_cp_clients_company ON public.customer_points_clients(company_id);
CREATE INDEX idx_cp_clients_cpf ON public.customer_points_clients(cpf);
CREATE INDEX idx_cp_clients_points ON public.customer_points_clients(total_points DESC);
CREATE INDEX idx_cp_transactions_company ON public.customer_points_transactions(company_id);
CREATE INDEX idx_cp_transactions_client ON public.customer_points_transactions(client_id);
CREATE INDEX idx_cp_transactions_created ON public.customer_points_transactions(created_at DESC);
CREATE INDEX idx_cp_rules_company ON public.customer_points_rules(company_id);
CREATE INDEX idx_cp_qr_company ON public.customer_points_qr_campaigns(company_id);
CREATE INDEX idx_cp_qr_token ON public.customer_points_qr_campaigns(access_token);

-- Enable RLS
ALTER TABLE public.customer_points_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_points_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_points_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_points_qr_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_points_config
CREATE POLICY "Users can view their company config"
ON public.customer_points_config FOR SELECT
USING (
  company_id IN (
    SELECT op.company_id FROM public.onboarding_projects op
    JOIN public.onboarding_users ou ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their company config"
ON public.customer_points_config FOR ALL
USING (
  company_id IN (
    SELECT op.company_id FROM public.onboarding_projects op
    JOIN public.onboarding_users ou ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid()
  )
);

-- RLS Policies for customer_points_clients
CREATE POLICY "Users can view their company clients"
ON public.customer_points_clients FOR SELECT
USING (
  company_id IN (
    SELECT op.company_id FROM public.onboarding_projects op
    JOIN public.onboarding_users ou ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their company clients"
ON public.customer_points_clients FOR ALL
USING (
  company_id IN (
    SELECT op.company_id FROM public.onboarding_projects op
    JOIN public.onboarding_users ou ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid()
  )
);

-- RLS Policies for customer_points_rules
CREATE POLICY "Users can view their company rules"
ON public.customer_points_rules FOR SELECT
USING (
  company_id IN (
    SELECT op.company_id FROM public.onboarding_projects op
    JOIN public.onboarding_users ou ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their company rules"
ON public.customer_points_rules FOR ALL
USING (
  company_id IN (
    SELECT op.company_id FROM public.onboarding_projects op
    JOIN public.onboarding_users ou ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid()
  )
);

-- RLS Policies for customer_points_transactions
CREATE POLICY "Users can view their company transactions"
ON public.customer_points_transactions FOR SELECT
USING (
  company_id IN (
    SELECT op.company_id FROM public.onboarding_projects op
    JOIN public.onboarding_users ou ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their company transactions"
ON public.customer_points_transactions FOR ALL
USING (
  company_id IN (
    SELECT op.company_id FROM public.onboarding_projects op
    JOIN public.onboarding_users ou ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid()
  )
);

-- RLS Policies for customer_points_qr_campaigns
CREATE POLICY "Users can view their company campaigns"
ON public.customer_points_qr_campaigns FOR SELECT
USING (
  company_id IN (
    SELECT op.company_id FROM public.onboarding_projects op
    JOIN public.onboarding_users ou ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their company campaigns"
ON public.customer_points_qr_campaigns FOR ALL
USING (
  company_id IN (
    SELECT op.company_id FROM public.onboarding_projects op
    JOIN public.onboarding_users ou ON ou.project_id = op.id
    WHERE ou.user_id = auth.uid()
  )
);

-- Public access for QR code forms (by token)
CREATE POLICY "Public can access campaigns by token"
ON public.customer_points_qr_campaigns FOR SELECT
USING (is_active = true);

CREATE POLICY "Public can insert clients via QR"
ON public.customer_points_clients FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can update client points via QR"
ON public.customer_points_clients FOR UPDATE
USING (true);

CREATE POLICY "Public can insert transactions via QR"
ON public.customer_points_transactions FOR INSERT
WITH CHECK (true);

-- Trigger to update client total_points
CREATE OR REPLACE FUNCTION public.update_customer_points_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.customer_points_clients
  SET 
    total_points = total_points + NEW.points,
    last_activity_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_customer_points
AFTER INSERT ON public.customer_points_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_points_total();

-- Trigger to increment QR campaign scans
CREATE OR REPLACE FUNCTION public.increment_qr_campaign_scans()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qr_campaign_id IS NOT NULL THEN
    UPDATE public.customer_points_qr_campaigns
    SET total_scans = total_scans + 1
    WHERE id = NEW.qr_campaign_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_increment_qr_scans
AFTER INSERT ON public.customer_points_transactions
FOR EACH ROW
EXECUTE FUNCTION public.increment_qr_campaign_scans();

-- Update timestamps trigger
CREATE TRIGGER update_cp_config_updated_at
BEFORE UPDATE ON public.customer_points_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cp_clients_updated_at
BEFORE UPDATE ON public.customer_points_clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cp_rules_updated_at
BEFORE UPDATE ON public.customer_points_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cp_qr_updated_at
BEFORE UPDATE ON public.customer_points_qr_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
