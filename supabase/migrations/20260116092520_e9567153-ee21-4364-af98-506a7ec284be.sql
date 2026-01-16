
-- CEO Decisions table
CREATE TABLE public.ceo_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
  area TEXT NOT NULL CHECK (area IN ('vendas', 'financeiro', 'produto', 'pessoas', 'marketing', 'operacoes')),
  type TEXT NOT NULL CHECK (type IN ('estrategica', 'tatica', 'operacional')),
  hypothesis TEXT,
  status TEXT NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada', 'em_execucao', 'concluida', 'cancelada')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CEO Decision Results table
CREATE TABLE public.ceo_decision_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_id UUID NOT NULL REFERENCES public.ceo_decisions(id) ON DELETE CASCADE,
  indicator_name TEXT NOT NULL,
  value_before NUMERIC,
  value_after NUMERIC,
  result TEXT CHECK (result IN ('positivo', 'neutro', 'negativo')),
  observations TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CEO Notes table
CREATE TABLE public.ceo_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  related_decision_id UUID REFERENCES public.ceo_decisions(id) ON DELETE SET NULL,
  related_company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE SET NULL,
  related_area TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CEO Tasks table
CREATE TABLE public.ceo_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baixa')),
  related_area TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  is_strategic BOOLEAN DEFAULT false,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CEO Agenda table
CREATE TABLE public.ceo_agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  event_type TEXT NOT NULL CHECK (event_type IN ('reuniao_estrategica', 'reuniao_cliente', 'reuniao_interna', 'evento', 'tempo_foco')),
  objective TEXT,
  attendees TEXT[],
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CEO Snapshots (monthly metrics history)
CREATE TABLE public.ceo_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  learnings TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CEO Alerts table
CREATE TABLE public.ceo_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.ceo_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_decision_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only CEO email can access
CREATE POLICY "CEO only access for ceo_decisions" ON public.ceo_decisions
  FOR ALL USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO only access for ceo_decision_results" ON public.ceo_decision_results
  FOR ALL USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO only access for ceo_notes" ON public.ceo_notes
  FOR ALL USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO only access for ceo_tasks" ON public.ceo_tasks
  FOR ALL USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO only access for ceo_agenda" ON public.ceo_agenda
  FOR ALL USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO only access for ceo_snapshots" ON public.ceo_snapshots
  FOR ALL USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO only access for ceo_alerts" ON public.ceo_alerts
  FOR ALL USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

-- Indexes for performance
CREATE INDEX idx_ceo_decisions_status ON public.ceo_decisions(status);
CREATE INDEX idx_ceo_decisions_date ON public.ceo_decisions(decision_date);
CREATE INDEX idx_ceo_tasks_status ON public.ceo_tasks(status);
CREATE INDEX idx_ceo_tasks_due_date ON public.ceo_tasks(due_date);
CREATE INDEX idx_ceo_agenda_start_time ON public.ceo_agenda(start_time);
CREATE INDEX idx_ceo_alerts_is_read ON public.ceo_alerts(is_read);
CREATE INDEX idx_ceo_notes_tags ON public.ceo_notes USING GIN(tags);

-- Trigger for updated_at
CREATE TRIGGER update_ceo_decisions_updated_at BEFORE UPDATE ON public.ceo_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ceo_notes_updated_at BEFORE UPDATE ON public.ceo_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ceo_tasks_updated_at BEFORE UPDATE ON public.ceo_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ceo_agenda_updated_at BEFORE UPDATE ON public.ceo_agenda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
