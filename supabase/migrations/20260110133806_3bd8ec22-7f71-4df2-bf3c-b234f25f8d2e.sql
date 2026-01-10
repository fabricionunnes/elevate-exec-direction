-- Tabela de estratégias vinculadas ao planejamento
CREATE TABLE public.portal_strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.portal_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'geral',
  priority INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  responsible TEXT,
  expected_impact TEXT,
  resources_needed TEXT,
  success_metrics TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_portal_strategies_plan_id ON public.portal_strategies(plan_id);
CREATE INDEX idx_portal_strategies_status ON public.portal_strategies(status);

-- Enable RLS
ALTER TABLE public.portal_strategies ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso via empresa do usuário
CREATE POLICY "Users can view strategies from their company plans"
ON public.portal_strategies FOR SELECT
USING (
  plan_id IN (
    SELECT pp.id FROM public.portal_plans pp
    JOIN public.portal_users pu ON pu.company_id = pp.company_id
    WHERE pu.id = auth.uid()
  )
);

CREATE POLICY "Users can insert strategies to their company plans"
ON public.portal_strategies FOR INSERT
WITH CHECK (
  plan_id IN (
    SELECT pp.id FROM public.portal_plans pp
    JOIN public.portal_users pu ON pu.company_id = pp.company_id
    WHERE pu.id = auth.uid()
  )
);

CREATE POLICY "Users can update strategies from their company plans"
ON public.portal_strategies FOR UPDATE
USING (
  plan_id IN (
    SELECT pp.id FROM public.portal_plans pp
    JOIN public.portal_users pu ON pu.company_id = pp.company_id
    WHERE pu.id = auth.uid()
  )
);

CREATE POLICY "Users can delete strategies from their company plans"
ON public.portal_strategies FOR DELETE
USING (
  plan_id IN (
    SELECT pp.id FROM public.portal_plans pp
    JOIN public.portal_users pu ON pu.company_id = pp.company_id
    WHERE pu.id = auth.uid()
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_portal_strategies_updated_at
BEFORE UPDATE ON public.portal_strategies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();