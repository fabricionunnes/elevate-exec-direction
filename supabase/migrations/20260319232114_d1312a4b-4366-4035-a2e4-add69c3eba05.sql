
-- Automation Rules table
CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  conditions JSONB NOT NULL DEFAULT '[]',
  action_type TEXT NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Automation Executions log table
CREATE TABLE public.automation_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'success',
  trigger_data JSONB,
  action_result JSONB,
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Automation Templates table
CREATE TABLE public.automation_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  conditions JSONB NOT NULL DEFAULT '[]',
  action_type TEXT NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}',
  icon TEXT DEFAULT 'Zap',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admin/master staff can manage automation rules
CREATE POLICY "Staff admin/master can view automation rules"
  ON public.automation_rules FOR SELECT
  TO authenticated
  USING (public.is_staff_admin_or_master(auth.uid()));

CREATE POLICY "Staff admin/master can insert automation rules"
  ON public.automation_rules FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff_admin_or_master(auth.uid()));

CREATE POLICY "Staff admin/master can update automation rules"
  ON public.automation_rules FOR UPDATE
  TO authenticated
  USING (public.is_staff_admin_or_master(auth.uid()));

CREATE POLICY "Staff admin/master can delete automation rules"
  ON public.automation_rules FOR DELETE
  TO authenticated
  USING (public.is_staff_admin_or_master(auth.uid()));

-- Executions: admin/master can view
CREATE POLICY "Staff admin/master can view automation executions"
  ON public.automation_executions FOR SELECT
  TO authenticated
  USING (public.is_staff_admin_or_master(auth.uid()));

-- Templates: all authenticated can view, admin/master can manage
CREATE POLICY "Authenticated can view automation templates"
  ON public.automation_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff admin/master can manage automation templates"
  ON public.automation_templates FOR ALL
  TO authenticated
  USING (public.is_staff_admin_or_master(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.automation_templates (name, description, category, trigger_type, trigger_config, conditions, action_type, action_config, icon) VALUES
('Alertar CS quando NPS ≤ 6', 'Envia notificação para o CS responsável quando um NPS detrator é recebido', 'onboarding', 'nps_received', '{}', '[{"field": "score", "operator": "lte", "value": 6}]', 'send_notification', '{"target": "cs_responsible", "title": "⚠️ NPS Detrator recebido", "message": "O cliente {company_name} deu nota {score} no NPS"}', 'AlertTriangle'),
('Criar tarefa quando lead é ganho', 'Cria automaticamente uma tarefa de onboarding quando um lead é marcado como ganho no CRM', 'crm', 'lead_won', '{}', '[]', 'create_task', '{"title": "Onboarding - {lead_name}", "description": "Iniciar processo de onboarding do novo cliente"}', 'CheckCircle2'),
('Notificar pagamento atrasado 7 dias', 'Envia notificação quando um pagamento está atrasado há 7 dias', 'financial', 'payment_overdue', '{}', '[{"field": "days_overdue", "operator": "gte", "value": 7}]', 'send_notification', '{"target": "cs_responsible", "title": "💰 Pagamento atrasado", "message": "O cliente {company_name} tem pagamento atrasado há {days_overdue} dias"}', 'Clock'),
('Mover lead após 3 dias sem ação', 'Move lead para etapa "Sem Retorno" se ficar 3 dias sem atividade', 'crm', 'lead_inactive', '{}', '[{"field": "days_inactive", "operator": "gte", "value": 3}]', 'move_lead_stage', '{"target_stage_name": "Sem Retorno"}', 'ArrowRight'),
('Alertar Health Score crítico', 'Notifica CS e consultor quando Health Score cai abaixo de 40', 'onboarding', 'health_score_changed', '{}', '[{"field": "score", "operator": "lt", "value": 40}]', 'send_notification', '{"target": "both_responsible", "title": "🚨 Health Score Crítico", "message": "O cliente {company_name} está com Health Score {score}"}', 'Heart');
