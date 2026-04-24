
-- 1. Tabela de submissões
CREATE TABLE public.sales_scanner_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,

  -- Etapa 1
  full_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT NOT NULL,

  -- Etapa 2
  company_name TEXT,
  segment TEXT,
  revenue_range TEXT,
  sellers_count INTEGER,
  has_sales_manager BOOLEAN,

  -- Etapa 3
  lead_channels TEXT[],
  leads_per_month INTEGER,
  has_process TEXT, -- sim | nao | parcial

  -- Etapa 4 - indicadores
  avg_ticket NUMERIC,
  conversion_rate NUMERIC, -- %
  sales_cycle_days INTEGER,
  sales_per_month INTEGER,
  has_crm BOOLEAN,
  tracks_goals_daily BOOLEAN,

  -- Etapa 5 - marketing
  invests_paid_traffic BOOLEAN,
  paid_traffic_monthly NUMERIC,
  cost_per_lead NUMERIC,
  has_marketing_team BOOLEAN,

  -- Etapa 6 - maturidade (1-5)
  maturity_organization INTEGER,
  maturity_goals INTEGER,
  maturity_predictability INTEGER,
  maturity_lead_quality INTEGER,
  maturity_performance INTEGER,

  -- Diagnóstico IA
  diagnosis_text TEXT,
  performance_level TEXT, -- baixo | medio | alto
  bottlenecks TEXT[],
  current_revenue NUMERIC,
  potential_revenue NUMERIC,
  monthly_loss NUMERIC,
  annual_loss NUMERIC,
  action_plan JSONB,

  -- Status do funil
  funnel_status TEXT NOT NULL DEFAULT 'initial', -- initial | completed | requested_meeting

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  meeting_requested_at TIMESTAMPTZ
);

CREATE INDEX idx_scanner_lead_id ON public.sales_scanner_submissions(lead_id);
CREATE INDEX idx_scanner_email ON public.sales_scanner_submissions(email);
CREATE INDEX idx_scanner_created_at ON public.sales_scanner_submissions(created_at DESC);

ALTER TABLE public.sales_scanner_submissions ENABLE ROW LEVEL SECURITY;

-- Público pode inserir e atualizar (com base no id retornado, já que é multi-step)
CREATE POLICY "Anyone can insert scanner submission"
  ON public.sales_scanner_submissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update scanner submission"
  ON public.sales_scanner_submissions FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can read own submission"
  ON public.sales_scanner_submissions FOR SELECT
  USING (true);

-- Trigger updated_at
CREATE TRIGGER trg_scanner_updated_at
  BEFORE UPDATE ON public.sales_scanner_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Cria pipeline Scanner de Vendas UNV se não existir
DO $$
DECLARE
  v_pipeline_id UUID;
BEGIN
  SELECT id INTO v_pipeline_id FROM public.crm_pipelines WHERE name = 'Scanner de Vendas UNV' LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    INSERT INTO public.crm_pipelines (name, is_active)
    VALUES ('Scanner de Vendas UNV', true)
    RETURNING id INTO v_pipeline_id;

    INSERT INTO public.crm_stages (pipeline_id, name, sort_order, color) VALUES
      (v_pipeline_id, 'Dados iniciais', 1, '#3b82f6'),
      (v_pipeline_id, 'Preencheu formulário', 2, '#8b5cf6'),
      (v_pipeline_id, 'Solicitou reunião', 3, '#f59e0b'),
      (v_pipeline_id, 'Ganho', 4, '#10b981'),
      (v_pipeline_id, 'Perdido', 5, '#ef4444');
  END IF;
END $$;
