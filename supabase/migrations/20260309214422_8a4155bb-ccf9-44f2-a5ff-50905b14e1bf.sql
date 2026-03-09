
-- Sales Funnels main table
CREATE TABLE public.sales_funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  responsible_staff_id UUID REFERENCES public.onboarding_staff(id),
  is_template BOOLEAN NOT NULL DEFAULT false,
  template_category TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales Funnel Stages
CREATE TABLE public.sales_funnel_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.sales_funnels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  stage_type TEXT NOT NULL DEFAULT 'custom',
  responsible TEXT,
  required_tasks TEXT,
  expected_conversion_rate NUMERIC(5,2),
  expected_avg_time_days NUMERIC(5,1),
  indicators TEXT,
  position_x NUMERIC NOT NULL DEFAULT 0,
  position_y NUMERIC NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  crm_stage_id UUID REFERENCES public.crm_stages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales Funnel Connections between stages
CREATE TABLE public.sales_funnel_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.sales_funnels(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES public.sales_funnel_stages(id) ON DELETE CASCADE,
  to_stage_id UUID NOT NULL REFERENCES public.sales_funnel_stages(id) ON DELETE CASCADE,
  label TEXT,
  conversion_rate NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales Funnel Metrics (actual data for analytics)
CREATE TABLE public.sales_funnel_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.sales_funnels(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.sales_funnel_stages(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  leads_count INTEGER NOT NULL DEFAULT 0,
  converted_count INTEGER NOT NULL DEFAULT 0,
  lost_count INTEGER NOT NULL DEFAULT 0,
  avg_time_days NUMERIC(5,1),
  revenue_cents BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales Funnel Templates (library of pre-built funnels)
CREATE TABLE public.sales_funnel_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'geral',
  segment TEXT,
  stages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  connections_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales Funnel AI Insights
CREATE TABLE public.sales_funnel_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.sales_funnels(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL DEFAULT 'optimization',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_funnel_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_funnel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_funnel_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_funnel_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_funnel_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_funnels
CREATE POLICY "Staff can manage funnels" ON public.sales_funnels
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Clients can view their project funnels" ON public.sales_funnels
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_users
      WHERE user_id = auth.uid() AND project_id = sales_funnels.project_id
    )
  );

-- RLS for stages
CREATE POLICY "Staff can manage stages" ON public.sales_funnel_stages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Clients can view stages" ON public.sales_funnel_stages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_funnels sf
      JOIN public.onboarding_users ou ON ou.project_id = sf.project_id
      WHERE sf.id = sales_funnel_stages.funnel_id AND ou.user_id = auth.uid()
    )
  );

-- RLS for connections
CREATE POLICY "Staff can manage connections" ON public.sales_funnel_connections
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Clients can view connections" ON public.sales_funnel_connections
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_funnels sf
      JOIN public.onboarding_users ou ON ou.project_id = sf.project_id
      WHERE sf.id = sales_funnel_connections.funnel_id AND ou.user_id = auth.uid()
    )
  );

-- RLS for metrics
CREATE POLICY "Staff can manage metrics" ON public.sales_funnel_metrics
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Clients can view metrics" ON public.sales_funnel_metrics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_funnels sf
      JOIN public.onboarding_users ou ON ou.project_id = sf.project_id
      WHERE sf.id = sales_funnel_metrics.funnel_id AND ou.user_id = auth.uid()
    )
  );

-- RLS for templates (public read for all authenticated)
CREATE POLICY "Anyone can view templates" ON public.sales_funnel_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage templates" ON public.sales_funnel_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS for insights
CREATE POLICY "Staff can manage insights" ON public.sales_funnel_insights
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Clients can view insights" ON public.sales_funnel_insights
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_funnels sf
      JOIN public.onboarding_users ou ON ou.project_id = sf.project_id
      WHERE sf.id = sales_funnel_insights.funnel_id AND ou.user_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_sales_funnels_updated_at
  BEFORE UPDATE ON public.sales_funnels
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

CREATE TRIGGER update_sales_funnel_stages_updated_at
  BEFORE UPDATE ON public.sales_funnel_stages
  FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

-- Insert default templates
INSERT INTO public.sales_funnel_templates (name, description, category, segment, stages_json, connections_json) VALUES
('Funil Consultivo B2B', 'Funil para vendas consultivas B2B com ciclo médio-longo', 'b2b', 'Consultoria', 
 '[{"name":"Lead","type":"entry","x":400,"y":50,"color":"#3b82f6"},{"name":"Qualificação","type":"qualification","x":400,"y":150,"color":"#8b5cf6"},{"name":"Diagnóstico","type":"custom","x":400,"y":250,"color":"#6366f1"},{"name":"Reunião Estratégica","type":"meeting","x":400,"y":350,"color":"#0ea5e9"},{"name":"Proposta","type":"proposal","x":400,"y":450,"color":"#f59e0b"},{"name":"Negociação","type":"negotiation","x":400,"y":550,"color":"#ef4444"},{"name":"Fechamento","type":"closing","x":400,"y":650,"color":"#22c55e"},{"name":"Perdido","type":"lost","x":200,"y":550,"color":"#6b7280"}]',
 '[{"from":0,"to":1},{"from":1,"to":2},{"from":2,"to":3},{"from":3,"to":4},{"from":4,"to":5},{"from":5,"to":6},{"from":4,"to":7},{"from":5,"to":7}]'),
('Funil Inbound Marketing', 'Funil para captação via marketing digital', 'inbound', 'Marketing Digital',
 '[{"name":"Visitante","type":"entry","x":400,"y":50,"color":"#3b82f6"},{"name":"Lead","type":"custom","x":400,"y":150,"color":"#8b5cf6"},{"name":"MQL","type":"qualification","x":400,"y":250,"color":"#6366f1"},{"name":"SQL","type":"qualification","x":400,"y":350,"color":"#0ea5e9"},{"name":"Oportunidade","type":"proposal","x":400,"y":450,"color":"#f59e0b"},{"name":"Cliente","type":"closing","x":400,"y":550,"color":"#22c55e"}]',
 '[{"from":0,"to":1},{"from":1,"to":2},{"from":2,"to":3},{"from":3,"to":4},{"from":4,"to":5}]'),
('Funil Outbound', 'Funil para prospecção ativa e cold calling', 'outbound', 'Prospecção',
 '[{"name":"Lista de Prospecção","type":"entry","x":400,"y":50,"color":"#3b82f6"},{"name":"Contato Inicial","type":"custom","x":400,"y":150,"color":"#8b5cf6"},{"name":"Qualificação","type":"qualification","x":400,"y":250,"color":"#6366f1"},{"name":"Reunião","type":"meeting","x":400,"y":350,"color":"#0ea5e9"},{"name":"Proposta","type":"proposal","x":400,"y":450,"color":"#f59e0b"},{"name":"Fechamento","type":"closing","x":400,"y":550,"color":"#22c55e"},{"name":"Perdido","type":"lost","x":200,"y":450,"color":"#6b7280"}]',
 '[{"from":0,"to":1},{"from":1,"to":2},{"from":2,"to":3},{"from":3,"to":4},{"from":4,"to":5},{"from":3,"to":6},{"from":4,"to":6}]'),
('Funil High Ticket', 'Funil para vendas de alto valor com processo mais longo', 'high_ticket', 'Alto Ticket',
 '[{"name":"Lead Qualificado","type":"entry","x":400,"y":50,"color":"#3b82f6"},{"name":"Pré-qualificação","type":"qualification","x":400,"y":130,"color":"#8b5cf6"},{"name":"Diagnóstico Profundo","type":"custom","x":400,"y":210,"color":"#6366f1"},{"name":"Imersão/Workshop","type":"meeting","x":400,"y":290,"color":"#0ea5e9"},{"name":"Proposta Personalizada","type":"proposal","x":400,"y":370,"color":"#f59e0b"},{"name":"Negociação","type":"negotiation","x":400,"y":450,"color":"#ef4444"},{"name":"Fechamento","type":"closing","x":400,"y":530,"color":"#22c55e"},{"name":"Onboarding","type":"post_sale","x":400,"y":610,"color":"#14b8a6"}]',
 '[{"from":0,"to":1},{"from":1,"to":2},{"from":2,"to":3},{"from":3,"to":4},{"from":4,"to":5},{"from":5,"to":6},{"from":6,"to":7}]'),
('Funil Clínica Estética', 'Funil para clínicas de estética e saúde', 'servicos', 'Clínica Estética',
 '[{"name":"Lead (Redes Sociais)","type":"entry","x":400,"y":50,"color":"#3b82f6"},{"name":"Contato WhatsApp","type":"custom","x":400,"y":150,"color":"#25d366"},{"name":"Avaliação Presencial","type":"meeting","x":400,"y":250,"color":"#8b5cf6"},{"name":"Proposta/Orçamento","type":"proposal","x":400,"y":350,"color":"#f59e0b"},{"name":"Fechamento","type":"closing","x":400,"y":450,"color":"#22c55e"},{"name":"Pós-procedimento","type":"post_sale","x":400,"y":550,"color":"#14b8a6"}]',
 '[{"from":0,"to":1},{"from":1,"to":2},{"from":2,"to":3},{"from":3,"to":4},{"from":4,"to":5}]'),
('Funil de Reativação', 'Funil para recuperar clientes inativos', 'reativacao', 'Reativação',
 '[{"name":"Base Inativa","type":"entry","x":400,"y":50,"color":"#6b7280"},{"name":"Contato de Reativação","type":"custom","x":400,"y":150,"color":"#3b82f6"},{"name":"Interesse Confirmado","type":"qualification","x":400,"y":250,"color":"#8b5cf6"},{"name":"Nova Proposta","type":"proposal","x":400,"y":350,"color":"#f59e0b"},{"name":"Reativado","type":"closing","x":400,"y":450,"color":"#22c55e"},{"name":"Sem Interesse","type":"lost","x":200,"y":350,"color":"#ef4444"}]',
 '[{"from":0,"to":1},{"from":1,"to":2},{"from":2,"to":3},{"from":3,"to":4},{"from":1,"to":5},{"from":2,"to":5}]');
