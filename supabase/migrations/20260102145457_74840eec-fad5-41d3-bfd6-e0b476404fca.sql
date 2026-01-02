-- Tabela de membros da equipe UNV (CS e Consultores separados das empresas)
CREATE TABLE public.onboarding_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('cs', 'consultant')),
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de empresas do onboarding (separada dos projetos)
CREATE TABLE public.onboarding_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  segment TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  -- Vínculos com CS e Consultor (não obrigatórios, podem ser alterados)
  cs_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  consultant_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  -- Kickoff completo
  kickoff_date DATE,
  contract_start_date DATE,
  contract_end_date DATE,
  contract_value NUMERIC,
  billing_day INTEGER,
  -- Briefing e metas
  company_description TEXT,
  main_challenges TEXT,
  goals_short_term TEXT,
  goals_long_term TEXT,
  target_audience TEXT,
  competitors TEXT,
  -- Stakeholders (JSON array)
  stakeholders JSONB DEFAULT '[]'::jsonb,
  -- Cronograma previsto (JSON)
  expected_timeline JSONB DEFAULT '{}'::jsonb,
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'churned')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar company_id à tabela de projetos existente
ALTER TABLE public.onboarding_projects 
  ADD COLUMN IF NOT EXISTS onboarding_company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE CASCADE;

-- Área central de documentos da empresa
CREATE TABLE public.onboarding_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.onboarding_tickets(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.onboarding_users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT DEFAULT 'general' CHECK (category IN ('contract', 'briefing', 'deliverable', 'reference', 'general')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Histórico de chat da IA por projeto
CREATE TABLE public.onboarding_ai_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Melhorar tarefas com mais campos (responsável, período, observações detalhadas)
ALTER TABLE public.onboarding_tasks
  ADD COLUMN IF NOT EXISTS responsible_staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Histórico de alterações nas tarefas (como Asana)
CREATE TABLE public.onboarding_task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.onboarding_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comentários nas tarefas
CREATE TABLE public.onboarding_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subtarefas
CREATE TABLE public.onboarding_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.onboarding_users(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Atualizar templates de tarefas com mais campos
ALTER TABLE public.onboarding_task_templates
  ADD COLUMN IF NOT EXISTS responsible_role TEXT CHECK (responsible_role IN ('cs', 'consultant', 'client')),
  ADD COLUMN IF NOT EXISTS duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;

-- Enable RLS on all new tables
ALTER TABLE public.onboarding_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_ai_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_subtasks ENABLE ROW LEVEL SECURITY;

-- Staff RLS (admins podem gerenciar, outros podem ver)
CREATE POLICY "Admins can manage staff" ON public.onboarding_staff
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_users WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can view staff" ON public.onboarding_staff
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Companies RLS
CREATE POLICY "Admins can manage companies" ON public.onboarding_companies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_users WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Staff can view assigned companies" ON public.onboarding_companies
  FOR SELECT USING (
    cs_id IN (SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid())
    OR consultant_id IN (SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Project members can view their company" ON public.onboarding_companies
  FOR SELECT USING (
    id IN (
      SELECT op.onboarding_company_id 
      FROM public.onboarding_projects op
      JOIN public.onboarding_users ou ON ou.project_id = op.id
      WHERE ou.user_id = auth.uid()
    )
  );

-- Documents RLS
CREATE POLICY "Project members can view documents" ON public.onboarding_documents
  FOR SELECT USING (
    company_id IN (
      SELECT op.onboarding_company_id 
      FROM public.onboarding_projects op
      JOIN public.onboarding_users ou ON ou.project_id = op.id
      WHERE ou.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage documents" ON public.onboarding_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_users 
      WHERE user_id = auth.uid() AND role IN ('admin', 'cs', 'consultant')
    )
  );

CREATE POLICY "Clients can insert documents" ON public.onboarding_documents
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT op.onboarding_company_id 
      FROM public.onboarding_projects op
      JOIN public.onboarding_users ou ON ou.project_id = op.id
      WHERE ou.user_id = auth.uid()
    )
  );

-- AI Chat RLS
CREATE POLICY "Project members can manage their AI chat" ON public.onboarding_ai_chat
  FOR ALL USING (is_onboarding_project_member(project_id));

-- Task History RLS
CREATE POLICY "Project members can view task history" ON public.onboarding_task_history
  FOR SELECT USING (
    task_id IN (
      SELECT t.id FROM public.onboarding_tasks t
      WHERE is_onboarding_project_member(t.project_id)
    )
  );

CREATE POLICY "Staff can insert task history" ON public.onboarding_task_history
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT t.id FROM public.onboarding_tasks t
      WHERE is_onboarding_project_member(t.project_id)
    )
  );

-- Task Comments RLS
CREATE POLICY "Project members can manage comments" ON public.onboarding_task_comments
  FOR ALL USING (
    task_id IN (
      SELECT t.id FROM public.onboarding_tasks t
      WHERE is_onboarding_project_member(t.project_id)
    )
  );

-- Subtasks RLS
CREATE POLICY "Project members can view subtasks" ON public.onboarding_subtasks
  FOR SELECT USING (
    task_id IN (
      SELECT t.id FROM public.onboarding_tasks t
      WHERE is_onboarding_project_member(t.project_id)
    )
  );

CREATE POLICY "Staff can manage subtasks" ON public.onboarding_subtasks
  FOR ALL USING (
    task_id IN (
      SELECT t.id FROM public.onboarding_tasks t
      WHERE is_onboarding_staff(t.project_id)
    )
  );

-- Create storage bucket for onboarding documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('onboarding-documents', 'onboarding-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for onboarding documents
CREATE POLICY "Authenticated users can upload onboarding documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'onboarding-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view onboarding documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'onboarding-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Staff can delete onboarding documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'onboarding-documents' AND auth.uid() IS NOT NULL);