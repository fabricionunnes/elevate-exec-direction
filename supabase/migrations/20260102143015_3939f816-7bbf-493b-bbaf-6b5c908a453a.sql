-- Enum for onboarding user roles
CREATE TYPE public.onboarding_role AS ENUM ('cs', 'consultant', 'client');

-- Enum for task status
CREATE TYPE public.onboarding_task_status AS ENUM ('pending', 'in_progress', 'completed');

-- Enum for ticket status
CREATE TYPE public.onboarding_ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Onboarding projects (one per client/product)
CREATE TABLE public.onboarding_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.portal_companies(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  created_by UUID REFERENCES public.portal_users(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Onboarding users (CS, consultants, clients with temp passwords)
CREATE TABLE public.onboarding_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  temp_password TEXT,
  role onboarding_role NOT NULL DEFAULT 'client',
  password_changed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Task templates (per product)
CREATE TABLE public.onboarding_task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  default_days_offset INTEGER DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Onboarding tasks (actual tasks for a project)
CREATE TABLE public.onboarding_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status onboarding_task_status NOT NULL DEFAULT 'pending',
  assignee_id UUID REFERENCES public.onboarding_users(id) ON DELETE SET NULL,
  observations TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tickets/chamados from clients
CREATE TABLE public.onboarding_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.onboarding_users(id),
  assigned_to UUID REFERENCES public.onboarding_users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status onboarding_ticket_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ticket replies
CREATE TABLE public.onboarding_ticket_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.onboarding_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.onboarding_users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_ticket_replies ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is part of onboarding project
CREATE OR REPLACE FUNCTION public.is_onboarding_project_member(check_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_users
    WHERE project_id = check_project_id 
    AND user_id = auth.uid()
  )
$$;

-- Helper function to check if user is CS/consultant on project
CREATE OR REPLACE FUNCTION public.is_onboarding_staff(check_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_users
    WHERE project_id = check_project_id 
    AND user_id = auth.uid()
    AND role IN ('cs', 'consultant')
  )
$$;

-- RLS Policies for onboarding_projects
CREATE POLICY "UNV admins can manage all projects"
ON public.onboarding_projects FOR ALL
USING (is_portal_admin_unv(auth.uid()));

CREATE POLICY "Project members can view their projects"
ON public.onboarding_projects FOR SELECT
USING (is_onboarding_project_member(id));

CREATE POLICY "Portal members can create projects"
ON public.onboarding_projects FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM portal_users WHERE user_id = auth.uid()
));

-- RLS Policies for onboarding_users
CREATE POLICY "UNV admins can manage all onboarding users"
ON public.onboarding_users FOR ALL
USING (is_portal_admin_unv(auth.uid()));

CREATE POLICY "Project members can view users in their project"
ON public.onboarding_users FOR SELECT
USING (is_onboarding_project_member(project_id));

CREATE POLICY "Staff can manage users in their project"
ON public.onboarding_users FOR ALL
USING (is_onboarding_staff(project_id));

-- RLS Policies for task templates (public read for authenticated)
CREATE POLICY "Anyone can view task templates"
ON public.onboarding_task_templates FOR SELECT
USING (true);

CREATE POLICY "UNV admins can manage task templates"
ON public.onboarding_task_templates FOR ALL
USING (is_portal_admin_unv(auth.uid()));

-- RLS Policies for onboarding_tasks
CREATE POLICY "UNV admins can manage all tasks"
ON public.onboarding_tasks FOR ALL
USING (is_portal_admin_unv(auth.uid()));

CREATE POLICY "Project members can view tasks"
ON public.onboarding_tasks FOR SELECT
USING (is_onboarding_project_member(project_id));

CREATE POLICY "Staff can manage tasks in their project"
ON public.onboarding_tasks FOR ALL
USING (is_onboarding_staff(project_id));

-- RLS Policies for tickets
CREATE POLICY "UNV admins can manage all tickets"
ON public.onboarding_tickets FOR ALL
USING (is_portal_admin_unv(auth.uid()));

CREATE POLICY "Project members can view tickets"
ON public.onboarding_tickets FOR SELECT
USING (is_onboarding_project_member(project_id));

CREATE POLICY "Project members can create tickets"
ON public.onboarding_tickets FOR INSERT
WITH CHECK (is_onboarding_project_member(project_id));

CREATE POLICY "Staff can manage tickets in their project"
ON public.onboarding_tickets FOR UPDATE
USING (is_onboarding_staff(project_id));

-- RLS Policies for ticket replies
CREATE POLICY "UNV admins can manage all replies"
ON public.onboarding_ticket_replies FOR ALL
USING (is_portal_admin_unv(auth.uid()));

CREATE POLICY "Project members can view replies"
ON public.onboarding_ticket_replies FOR SELECT
USING (EXISTS (
  SELECT 1 FROM onboarding_tickets t
  WHERE t.id = ticket_id AND is_onboarding_project_member(t.project_id)
));

CREATE POLICY "Project members can create replies"
ON public.onboarding_ticket_replies FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM onboarding_tickets t
  WHERE t.id = ticket_id AND is_onboarding_project_member(t.project_id)
));

-- Triggers for updated_at
CREATE TRIGGER update_onboarding_projects_updated_at
BEFORE UPDATE ON public.onboarding_projects
FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

CREATE TRIGGER update_onboarding_users_updated_at
BEFORE UPDATE ON public.onboarding_users
FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

CREATE TRIGGER update_onboarding_tasks_updated_at
BEFORE UPDATE ON public.onboarding_tasks
FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

CREATE TRIGGER update_onboarding_tickets_updated_at
BEFORE UPDATE ON public.onboarding_tickets
FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();

-- Insert default task templates for Core product
INSERT INTO public.onboarding_task_templates (product_id, title, description, default_days_offset, sort_order) VALUES
('core', 'Reunião de Kick-off', 'Alinhar expectativas e cronograma com o cliente', 0, 1),
('core', 'Diagnóstico Comercial', 'Mapear processos atuais de vendas', 3, 2),
('core', 'Definição de Metas', 'Estabelecer metas de vendas mensuráveis', 5, 3),
('core', 'Estruturação de Processos', 'Desenhar novos processos comerciais', 10, 4),
('core', 'Implementação de CRM', 'Configurar e treinar equipe no CRM', 15, 5),
('core', 'Treinamento de Vendas', 'Capacitar equipe com técnicas de vendas', 20, 6),
('core', 'Acompanhamento Semanal', 'Revisar métricas e ajustar estratégias', 25, 7),
('core', 'Entrega Final', 'Apresentar resultados e próximos passos', 30, 8);

-- Insert templates for Control
INSERT INTO public.onboarding_task_templates (product_id, title, description, default_days_offset, sort_order) VALUES
('control', 'Reunião de Kick-off', 'Alinhar expectativas e cronograma', 0, 1),
('control', 'Mapeamento de Indicadores', 'Identificar KPIs críticos', 3, 2),
('control', 'Setup de Dashboard', 'Configurar dashboards de vendas', 7, 3),
('control', 'Integração de Dados', 'Conectar fontes de dados ao sistema', 10, 4),
('control', 'Treinamento Gerencial', 'Capacitar gestores na análise de dados', 14, 5),
('control', 'Revisão de Rotinas', 'Implementar rituais de gestão', 18, 6),
('control', 'Entrega Final', 'Apresentar resultados e playbook', 21, 7);

-- Insert templates for Sales Acceleration
INSERT INTO public.onboarding_task_templates (product_id, title, description, default_days_offset, sort_order) VALUES
('sales-acceleration', 'Reunião de Kick-off', 'Alinhar expectativas e metas de aceleração', 0, 1),
('sales-acceleration', 'Análise de Pipeline', 'Diagnosticar gargalos no funil', 2, 2),
('sales-acceleration', 'Otimização de Processos', 'Redesenhar processos para velocidade', 5, 3),
('sales-acceleration', 'Implementação de Cadências', 'Configurar cadências de prospecção', 8, 4),
('sales-acceleration', 'Treinamento Intensivo', 'Workshops práticos de vendas', 12, 5),
('sales-acceleration', 'Acompanhamento de Resultados', 'Medir e ajustar estratégias', 18, 6),
('sales-acceleration', 'Entrega Final', 'Consolidar resultados e escalar', 25, 7);