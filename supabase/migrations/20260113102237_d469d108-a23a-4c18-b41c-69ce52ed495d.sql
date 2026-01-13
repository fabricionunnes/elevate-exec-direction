
-- =====================================================
-- CRM COMERCIAL - COMPLETE DATABASE SCHEMA
-- =====================================================

-- 1) Add new roles to staff if not exists (update role check constraint)
-- First, let's check existing roles and add new ones

-- 2) CRM Pipelines
CREATE TABLE public.crm_pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3) CRM Stages (Pipeline columns)
CREATE TABLE public.crm_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_final BOOLEAN DEFAULT false,
  final_type TEXT CHECK (final_type IN ('won', 'lost', NULL)),
  color TEXT DEFAULT '#6B7280',
  required_fields TEXT[] DEFAULT '{}',
  auto_activity_type TEXT,
  auto_activity_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4) Loss Reasons
CREATE TABLE public.crm_loss_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5) CRM Tags
CREATE TABLE public.crm_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6) CRM Leads (Main entity)
CREATE TABLE public.crm_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Identification
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  company TEXT,
  role TEXT,
  city TEXT,
  state TEXT,
  origin TEXT,
  owner_staff_id UUID REFERENCES public.onboarding_staff(id),
  team TEXT,
  
  -- Pipeline & Stage
  pipeline_id UUID REFERENCES public.crm_pipelines(id),
  stage_id UUID REFERENCES public.crm_stages(id),
  opportunity_value NUMERIC(15,2) DEFAULT 0,
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  entered_pipeline_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  next_activity_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  loss_reason_id UUID REFERENCES public.crm_loss_reasons(id),
  
  -- Qualification
  segment TEXT,
  estimated_revenue TEXT,
  employee_count TEXT,
  main_pain TEXT,
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high')),
  fit_score INTEGER CHECK (fit_score >= 0 AND fit_score <= 100),
  notes TEXT,
  
  -- Metadata
  created_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7) Lead Tags (Many-to-Many)
CREATE TABLE public.crm_lead_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.crm_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, tag_id)
);

-- 8) Lead History (Timeline/Audit)
CREATE TABLE public.crm_lead_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  staff_id UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9) CRM Activities (Tasks/Agenda)
CREATE TABLE public.crm_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('call', 'whatsapp', 'email', 'meeting', 'followup', 'proposal', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'overdue')),
  responsible_staff_id UUID REFERENCES public.onboarding_staff(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10) CRM Attachments
CREATE TABLE public.crm_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 11) CRM Settings (per-pipeline custom fields, rules)
CREATE TABLE public.crm_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB,
  updated_by UUID REFERENCES public.onboarding_staff(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_crm_leads_owner ON public.crm_leads(owner_staff_id);
CREATE INDEX idx_crm_leads_pipeline ON public.crm_leads(pipeline_id);
CREATE INDEX idx_crm_leads_stage ON public.crm_leads(stage_id);
CREATE INDEX idx_crm_leads_created ON public.crm_leads(created_at);
CREATE INDEX idx_crm_leads_next_activity ON public.crm_leads(next_activity_at);
CREATE INDEX idx_crm_activities_lead ON public.crm_activities(lead_id);
CREATE INDEX idx_crm_activities_responsible ON public.crm_activities(responsible_staff_id);
CREATE INDEX idx_crm_activities_scheduled ON public.crm_activities(scheduled_at);
CREATE INDEX idx_crm_activities_status ON public.crm_activities(status);
CREATE INDEX idx_crm_lead_history_lead ON public.crm_lead_history(lead_id);
CREATE INDEX idx_crm_stages_pipeline ON public.crm_stages(pipeline_id);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTION: Check if user has CRM access
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_crm_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('admin', 'head_comercial', 'closer', 'sdr')
  )
$$;

-- Helper function: Check if user is CRM admin (admin or head_comercial)
CREATE OR REPLACE FUNCTION public.is_crm_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role IN ('admin', 'head_comercial')
  )
$$;

-- Helper function: Get current staff id
CREATE OR REPLACE FUNCTION public.get_current_staff_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.onboarding_staff
  WHERE user_id = auth.uid()
  AND is_active = true
  LIMIT 1
$$;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Pipelines: CRM users can read, admins can write
CREATE POLICY "CRM users can view pipelines"
ON public.crm_pipelines FOR SELECT
USING (public.has_crm_access());

CREATE POLICY "CRM admins can manage pipelines"
ON public.crm_pipelines FOR ALL
USING (public.is_crm_admin());

-- Stages: CRM users can read, admins can write
CREATE POLICY "CRM users can view stages"
ON public.crm_stages FOR SELECT
USING (public.has_crm_access());

CREATE POLICY "CRM admins can manage stages"
ON public.crm_stages FOR ALL
USING (public.is_crm_admin());

-- Loss Reasons: CRM users can read, admins can write
CREATE POLICY "CRM users can view loss reasons"
ON public.crm_loss_reasons FOR SELECT
USING (public.has_crm_access());

CREATE POLICY "CRM admins can manage loss reasons"
ON public.crm_loss_reasons FOR ALL
USING (public.is_crm_admin());

-- Tags: CRM users can read, admins can write
CREATE POLICY "CRM users can view tags"
ON public.crm_tags FOR SELECT
USING (public.has_crm_access());

CREATE POLICY "CRM admins can manage tags"
ON public.crm_tags FOR ALL
USING (public.is_crm_admin());

-- Leads: Complex visibility rules
-- Admins/Head see all, SDR/Closer see only their own
CREATE POLICY "CRM admins can view all leads"
ON public.crm_leads FOR SELECT
USING (public.is_crm_admin());

CREATE POLICY "CRM users can view own leads"
ON public.crm_leads FOR SELECT
USING (
  public.has_crm_access() 
  AND owner_staff_id = public.get_current_staff_id()
);

CREATE POLICY "CRM users can insert leads"
ON public.crm_leads FOR INSERT
WITH CHECK (public.has_crm_access());

CREATE POLICY "CRM admins can update all leads"
ON public.crm_leads FOR UPDATE
USING (public.is_crm_admin());

CREATE POLICY "CRM users can update own leads"
ON public.crm_leads FOR UPDATE
USING (
  public.has_crm_access() 
  AND owner_staff_id = public.get_current_staff_id()
);

CREATE POLICY "CRM admins can delete leads"
ON public.crm_leads FOR DELETE
USING (public.is_crm_admin());

-- Lead Tags: Follow lead visibility
CREATE POLICY "CRM users can view lead tags"
ON public.crm_lead_tags FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_leads
    WHERE id = lead_id
    AND (public.is_crm_admin() OR owner_staff_id = public.get_current_staff_id())
  )
);

CREATE POLICY "CRM users can manage lead tags"
ON public.crm_lead_tags FOR ALL
USING (public.has_crm_access());

-- Lead History: Follow lead visibility
CREATE POLICY "CRM users can view lead history"
ON public.crm_lead_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_leads
    WHERE id = lead_id
    AND (public.is_crm_admin() OR owner_staff_id = public.get_current_staff_id())
  )
);

CREATE POLICY "CRM users can insert lead history"
ON public.crm_lead_history FOR INSERT
WITH CHECK (public.has_crm_access());

-- Activities: Follow lead visibility
CREATE POLICY "CRM admins can view all activities"
ON public.crm_activities FOR SELECT
USING (public.is_crm_admin());

CREATE POLICY "CRM users can view own activities"
ON public.crm_activities FOR SELECT
USING (
  public.has_crm_access() 
  AND (
    responsible_staff_id = public.get_current_staff_id()
    OR EXISTS (
      SELECT 1 FROM public.crm_leads
      WHERE id = lead_id
      AND owner_staff_id = public.get_current_staff_id()
    )
  )
);

CREATE POLICY "CRM users can manage activities"
ON public.crm_activities FOR ALL
USING (public.has_crm_access());

-- Attachments: Follow lead visibility
CREATE POLICY "CRM users can view attachments"
ON public.crm_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crm_leads
    WHERE id = lead_id
    AND (public.is_crm_admin() OR owner_staff_id = public.get_current_staff_id())
  )
);

CREATE POLICY "CRM users can manage attachments"
ON public.crm_attachments FOR ALL
USING (public.has_crm_access());

-- Settings: Only admins
CREATE POLICY "CRM admins can manage settings"
ON public.crm_settings FOR ALL
USING (public.is_crm_admin());

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE TRIGGER update_crm_pipelines_updated_at
BEFORE UPDATE ON public.crm_pipelines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_stages_updated_at
BEFORE UPDATE ON public.crm_stages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_leads_updated_at
BEFORE UPDATE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_activities_updated_at
BEFORE UPDATE ON public.crm_activities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- AUTO-LOG LEAD STAGE CHANGES
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_stage_name TEXT;
  v_new_stage_name TEXT;
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    SELECT name INTO v_old_stage_name FROM public.crm_stages WHERE id = OLD.stage_id;
    SELECT name INTO v_new_stage_name FROM public.crm_stages WHERE id = NEW.stage_id;
    
    INSERT INTO public.crm_lead_history (lead_id, action, field_changed, old_value, new_value, staff_id)
    VALUES (NEW.id, 'stage_change', 'stage_id', v_old_stage_name, v_new_stage_name, public.get_current_staff_id());
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_lead_stage_change
AFTER UPDATE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_stage_change();

-- =====================================================
-- UPDATE LAST ACTIVITY ON LEAD
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_lead_activity_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update last_activity_at when activity is completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.crm_leads
    SET last_activity_at = NEW.completed_at
    WHERE id = NEW.lead_id;
  END IF;
  
  -- Recalculate next_activity_at
  UPDATE public.crm_leads
  SET next_activity_at = (
    SELECT MIN(scheduled_at)
    FROM public.crm_activities
    WHERE lead_id = NEW.lead_id
    AND status = 'pending'
    AND scheduled_at IS NOT NULL
  )
  WHERE id = NEW.lead_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_lead_activity_dates
AFTER INSERT OR UPDATE ON public.crm_activities
FOR EACH ROW EXECUTE FUNCTION public.update_lead_activity_dates();

-- =====================================================
-- INSERT DEFAULT DATA
-- =====================================================

-- Default pipeline
INSERT INTO public.crm_pipelines (name, description, is_default)
VALUES ('Pipeline Principal', 'Pipeline padrão para vendas', true);

-- Default stages for the pipeline
INSERT INTO public.crm_stages (pipeline_id, name, sort_order, color)
SELECT id, 'Novo Lead', 0, '#6B7280' FROM public.crm_pipelines WHERE is_default = true;

INSERT INTO public.crm_stages (pipeline_id, name, sort_order, color)
SELECT id, 'Qualificação', 1, '#3B82F6' FROM public.crm_pipelines WHERE is_default = true;

INSERT INTO public.crm_stages (pipeline_id, name, sort_order, color)
SELECT id, 'Reunião Marcada', 2, '#8B5CF6' FROM public.crm_pipelines WHERE is_default = true;

INSERT INTO public.crm_stages (pipeline_id, name, sort_order, color)
SELECT id, 'Reunião Realizada', 3, '#F59E0B' FROM public.crm_pipelines WHERE is_default = true;

INSERT INTO public.crm_stages (pipeline_id, name, sort_order, color)
SELECT id, 'Proposta', 4, '#EC4899' FROM public.crm_pipelines WHERE is_default = true;

INSERT INTO public.crm_stages (pipeline_id, name, sort_order, color)
SELECT id, 'Negociação', 5, '#10B981' FROM public.crm_pipelines WHERE is_default = true;

INSERT INTO public.crm_stages (pipeline_id, name, sort_order, is_final, final_type, color)
SELECT id, 'Ganho', 6, true, 'won', '#22C55E' FROM public.crm_pipelines WHERE is_default = true;

INSERT INTO public.crm_stages (pipeline_id, name, sort_order, is_final, final_type, color)
SELECT id, 'Perdido', 7, true, 'lost', '#EF4444' FROM public.crm_pipelines WHERE is_default = true;

-- Default loss reasons
INSERT INTO public.crm_loss_reasons (name, sort_order) VALUES
('Preço', 1),
('Timing - Não é o momento', 2),
('Concorrente', 3),
('Sem resposta/Ghosting', 4),
('Não tem fit', 5),
('Decidiu não fazer nada', 6),
('Outro', 7);

-- Default tags
INSERT INTO public.crm_tags (name, color) VALUES
('Hot', '#EF4444'),
('Indicação', '#22C55E'),
('Inbound', '#3B82F6'),
('Outbound', '#8B5CF6'),
('Reativação', '#F59E0B');

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_lead_history;
