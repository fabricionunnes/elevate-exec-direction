-- Tabela de tipos de meta personalizáveis
CREATE TABLE public.crm_goal_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  unit_type TEXT NOT NULL DEFAULT 'number', -- 'number', 'currency', 'percentage'
  category TEXT, -- 'closer', 'sdr', 'general' ou null para todos
  has_super_meta BOOLEAN NOT NULL DEFAULT true,
  has_hiper_meta BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de metas por colaborador/mês (flexível)
CREATE TABLE public.crm_goal_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  goal_type_id UUID NOT NULL REFERENCES public.crm_goal_types(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  meta_value NUMERIC NOT NULL DEFAULT 0,
  super_meta_value NUMERIC,
  hiper_meta_value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(staff_id, goal_type_id, month, year)
);

-- Enable RLS
ALTER TABLE public.crm_goal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_goal_values ENABLE ROW LEVEL SECURITY;

-- Policies for goal types (admin can manage, all can read)
CREATE POLICY "Anyone can view active goal types"
ON public.crm_goal_types FOR SELECT
USING (true);

CREATE POLICY "Admins can manage goal types"
ON public.crm_goal_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('master', 'admin')
  )
);

-- Policies for goal values (admin can manage, all can read)
CREATE POLICY "Anyone can view goal values"
ON public.crm_goal_values FOR SELECT
USING (true);

CREATE POLICY "Admins can manage goal values"
ON public.crm_goal_values FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('master', 'admin')
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_crm_goal_values_updated_at
BEFORE UPDATE ON public.crm_goal_values
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir tipos de meta padrão
INSERT INTO public.crm_goal_types (name, description, unit_type, category, sort_order) VALUES
-- Closer
('Vendas', 'Meta de faturamento em vendas', 'currency', 'closer', 1),
('Reuniões Realizadas', 'Número de reuniões efetivamente realizadas', 'number', 'closer', 2),
('Conversão', 'Taxa de conversão de leads em vendas', 'percentage', 'closer', 3),
('Ticket Médio', 'Valor médio por venda', 'currency', 'closer', 4),
-- SDR
('Agendamentos', 'Número de reuniões agendadas', 'number', 'sdr', 10),
('Prospecções', 'Número de leads prospectados', 'number', 'sdr', 11),
('Show Up', 'Reuniões que o lead compareceu', 'number', 'sdr', 12),
('No Show', 'Reuniões que o lead não compareceu', 'number', 'sdr', 13),
('Ligações', 'Número de ligações realizadas', 'number', 'sdr', 14),
('Contatos Feitos', 'Contatos efetivos com leads', 'number', 'sdr', 15);