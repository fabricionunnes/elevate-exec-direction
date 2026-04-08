CREATE TABLE public.client_strategic_diagnostics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  
  empresa TEXT NOT NULL,
  responsavel TEXT,
  consultor_unv TEXT,
  data_checkpoint DATE NOT NULL DEFAULT CURRENT_DATE,
  tempo_cliente TEXT,
  segmento TEXT,
  
  faturamento_atual NUMERIC,
  faturamento_entrada NUMERIC,
  margem_lucro NUMERIC,
  ticket_medio NUMERIC,
  possui_dividas TEXT,
  controle_financeiro TEXT,
  gestao_financeira TEXT,
  usa_contador TEXT,
  maior_dor_financeira TEXT,
  observacoes_financeiras TEXT,
  
  num_vendedores INTEGER,
  meta_vendas NUMERIC,
  resultado_ultimo_mes NUMERIC,
  taxa_conversao NUMERIC,
  possui_sdr TEXT,
  usa_crm TEXT,
  tem_script TEXT,
  principal_canal TEXT,
  maior_dor_comercial TEXT,
  observacoes_comerciais TEXT,
  
  investe_trafego TEXT,
  quem_gerencia_trafego TEXT,
  investimento_trafego NUMERIC,
  cpl_estimado NUMERIC,
  volume_leads INTEGER,
  plataformas_trafego TEXT[],
  satisfeito_trafego TEXT,
  acompanha_relatorios TEXT,
  observacoes_trafego TEXT,
  
  quem_faz_social TEXT,
  investimento_social NUMERIC,
  seguidores_instagram INTEGER,
  engajamento_medio NUMERIC,
  frequencia_postagens TEXT,
  redes_ativas TEXT[],
  identidade_visual TEXT,
  produz_video TEXT,
  satisfeito_social TEXT,
  social_gera_leads TEXT,
  observacoes_marketing TEXT,
  
  principais_dores TEXT,
  produtos_oferecer TEXT[],
  proximo_passo TEXT,
  nivel_urgencia TEXT,
  potencial_upsell NUMERIC,
  observacoes_gerais TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_strategic_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view strategic diagnostics"
  ON public.client_strategic_diagnostics FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Auth users can insert strategic diagnostics"
  ON public.client_strategic_diagnostics FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can update strategic diagnostics"
  ON public.client_strategic_diagnostics FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Auth users can delete strategic diagnostics"
  ON public.client_strategic_diagnostics FOR DELETE
  TO authenticated USING (true);

CREATE INDEX idx_strategic_diagnostics_project ON public.client_strategic_diagnostics (project_id, created_at DESC);