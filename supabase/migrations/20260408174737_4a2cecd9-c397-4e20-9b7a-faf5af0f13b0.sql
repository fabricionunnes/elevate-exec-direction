
-- =====================================================
-- CLIENT CRM - FULL STRUCTURE
-- =====================================================

-- 1. Origin Groups (agrupamento de origens por projeto)
CREATE TABLE IF NOT EXISTS public.client_crm_origin_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_crm_origin_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can manage origin groups" ON public.client_crm_origin_groups
  FOR ALL TO authenticated
  USING (is_onboarding_project_member(project_id))
  WITH CHECK (is_onboarding_project_member(project_id));
CREATE POLICY "Staff can access origin groups" ON public.client_crm_origin_groups
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- 2. Origins (origens de leads vinculadas a pipelines)
CREATE TABLE IF NOT EXISTS public.client_crm_origins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_id UUID REFERENCES client_crm_origin_groups(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES client_crm_pipelines(id) ON DELETE SET NULL,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_crm_origins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can manage origins" ON public.client_crm_origins
  FOR ALL TO authenticated
  USING (is_onboarding_project_member(project_id))
  WITH CHECK (is_onboarding_project_member(project_id));
CREATE POLICY "Staff can access origins" ON public.client_crm_origins
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- 3. Tags (definições de tags por projeto)
CREATE TABLE IF NOT EXISTS public.client_crm_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_crm_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can manage tags" ON public.client_crm_tags
  FOR ALL TO authenticated
  USING (is_onboarding_project_member(project_id))
  WITH CHECK (is_onboarding_project_member(project_id));
CREATE POLICY "Staff can access tags" ON public.client_crm_tags
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- 4. Loss Reasons (motivos de perda por projeto)
CREATE TABLE IF NOT EXISTS public.client_crm_loss_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_crm_loss_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can manage loss reasons" ON public.client_crm_loss_reasons
  FOR ALL TO authenticated
  USING (is_onboarding_project_member(project_id))
  WITH CHECK (is_onboarding_project_member(project_id));
CREATE POLICY "Staff can access loss reasons" ON public.client_crm_loss_reasons
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- 5. Leads (tabela principal espelhando crm_leads)
CREATE TABLE IF NOT EXISTS public.client_crm_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  company TEXT,
  role TEXT,
  city TEXT,
  state TEXT,
  document TEXT,
  trade_name TEXT,
  pipeline_id UUID REFERENCES client_crm_pipelines(id) ON DELETE SET NULL,
  stage_id UUID NOT NULL REFERENCES client_crm_stages(id) ON DELETE RESTRICT,
  origin_id UUID REFERENCES client_crm_origins(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES onboarding_users(id) ON DELETE SET NULL,
  opportunity_value NUMERIC(15,2) DEFAULT 0,
  probability INTEGER DEFAULT 0,
  segment TEXT,
  estimated_revenue TEXT,
  employee_count TEXT,
  main_pain TEXT,
  urgency TEXT,
  fit_score INTEGER,
  notes TEXT,
  loss_reason_id UUID REFERENCES client_crm_loss_reasons(id) ON DELETE SET NULL,
  entered_pipeline_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  next_activity_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES onboarding_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_crm_leads_project ON public.client_crm_leads(project_id);
CREATE INDEX idx_client_crm_leads_pipeline ON public.client_crm_leads(pipeline_id);
CREATE INDEX idx_client_crm_leads_stage ON public.client_crm_leads(stage_id);
CREATE INDEX idx_client_crm_leads_origin ON public.client_crm_leads(origin_id);
CREATE INDEX idx_client_crm_leads_owner ON public.client_crm_leads(owner_id);
ALTER TABLE public.client_crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can manage leads" ON public.client_crm_leads
  FOR ALL TO authenticated
  USING (is_onboarding_project_member(project_id))
  WITH CHECK (is_onboarding_project_member(project_id));
CREATE POLICY "Staff can access leads" ON public.client_crm_leads
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- Enable realtime for leads
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_crm_leads;

-- 6. Lead Tags (N:N)
CREATE TABLE IF NOT EXISTS public.client_crm_lead_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES client_crm_leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES client_crm_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id, tag_id)
);
CREATE INDEX idx_client_crm_lead_tags_lead ON public.client_crm_lead_tags(lead_id);
ALTER TABLE public.client_crm_lead_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can manage lead tags" ON public.client_crm_lead_tags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM client_crm_leads WHERE id = lead_id AND is_onboarding_project_member(project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM client_crm_leads WHERE id = lead_id AND is_onboarding_project_member(project_id)));
CREATE POLICY "Staff can access lead tags" ON public.client_crm_lead_tags
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- 7. Lead History (histórico de alterações)
CREATE TABLE IF NOT EXISTS public.client_crm_lead_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES client_crm_leads(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  user_id UUID REFERENCES onboarding_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_crm_lead_history_lead ON public.client_crm_lead_history(lead_id);
ALTER TABLE public.client_crm_lead_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can manage history" ON public.client_crm_lead_history
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM client_crm_leads WHERE id = lead_id AND is_onboarding_project_member(project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM client_crm_leads WHERE id = lead_id AND is_onboarding_project_member(project_id)));
CREATE POLICY "Staff can access history" ON public.client_crm_lead_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- 8. Lead Activities (atividades vinculadas a leads)
CREATE TABLE IF NOT EXISTS public.client_crm_lead_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES client_crm_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('call', 'whatsapp', 'email', 'meeting', 'followup', 'proposal', 'note', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'overdue')),
  responsible_user_id UUID REFERENCES onboarding_users(id) ON DELETE SET NULL,
  notes TEXT,
  meeting_link TEXT,
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_crm_lead_activities_lead ON public.client_crm_lead_activities(lead_id);
CREATE INDEX idx_client_crm_lead_activities_project ON public.client_crm_lead_activities(project_id);
CREATE INDEX idx_client_crm_lead_activities_status ON public.client_crm_lead_activities(status);
CREATE INDEX idx_client_crm_lead_activities_scheduled ON public.client_crm_lead_activities(scheduled_at);
ALTER TABLE public.client_crm_lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can manage activities" ON public.client_crm_lead_activities
  FOR ALL TO authenticated
  USING (is_onboarding_project_member(project_id))
  WITH CHECK (is_onboarding_project_member(project_id));
CREATE POLICY "Staff can access activities" ON public.client_crm_lead_activities
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_crm_lead_activities;

-- 9. Stage Checklists
CREATE TABLE IF NOT EXISTS public.client_crm_stage_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES client_crm_stages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  item_type TEXT DEFAULT 'instruction',
  whatsapp_template TEXT,
  whatsapp_attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_crm_stage_checklists_stage ON public.client_crm_stage_checklists(stage_id);
ALTER TABLE public.client_crm_stage_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can manage checklists" ON public.client_crm_stage_checklists
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM client_crm_stages s
    JOIN client_crm_pipelines p ON p.id = s.pipeline_id
    WHERE s.id = stage_id AND is_onboarding_project_member(p.project_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM client_crm_stages s
    JOIN client_crm_pipelines p ON p.id = s.pipeline_id
    WHERE s.id = stage_id AND is_onboarding_project_member(p.project_id)
  ));
CREATE POLICY "Staff can access checklists" ON public.client_crm_stage_checklists
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- 10. Lead Checklist Items (itens concluídos por lead)
CREATE TABLE IF NOT EXISTS public.client_crm_lead_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES client_crm_leads(id) ON DELETE CASCADE,
  checklist_id UUID NOT NULL REFERENCES client_crm_stage_checklists(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  completed_by UUID REFERENCES onboarding_users(id) ON DELETE SET NULL,
  UNIQUE(lead_id, checklist_id)
);
ALTER TABLE public.client_crm_lead_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can manage checklist items" ON public.client_crm_lead_checklist_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM client_crm_leads WHERE id = lead_id AND is_onboarding_project_member(project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM client_crm_leads WHERE id = lead_id AND is_onboarding_project_member(project_id)));
CREATE POLICY "Staff can access checklist items" ON public.client_crm_lead_checklist_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- 11. Transcriptions
CREATE TABLE IF NOT EXISTS public.client_crm_transcriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES client_crm_leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  transcription_text TEXT,
  summary TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  duration_seconds INTEGER,
  language TEXT DEFAULT 'pt-BR',
  speakers JSONB DEFAULT '[]',
  highlights JSONB DEFAULT '[]',
  ai_analysis TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  recorded_at TIMESTAMPTZ,
  created_by UUID REFERENCES onboarding_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_crm_transcriptions_project ON public.client_crm_transcriptions(project_id);
CREATE INDEX idx_client_crm_transcriptions_lead ON public.client_crm_transcriptions(lead_id);
ALTER TABLE public.client_crm_transcriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can manage transcriptions" ON public.client_crm_transcriptions
  FOR ALL TO authenticated
  USING (is_onboarding_project_member(project_id))
  WITH CHECK (is_onboarding_project_member(project_id));
CREATE POLICY "Staff can access transcriptions" ON public.client_crm_transcriptions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- 12. Forecasts
CREATE TABLE IF NOT EXISTS public.client_crm_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES client_crm_leads(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES onboarding_users(id) ON DELETE SET NULL,
  product_name TEXT,
  forecast_value NUMERIC NOT NULL DEFAULT 0,
  expected_close_date DATE,
  status TEXT DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_client_crm_forecasts_project ON public.client_crm_forecasts(project_id);
ALTER TABLE public.client_crm_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can manage forecasts" ON public.client_crm_forecasts
  FOR ALL TO authenticated
  USING (is_onboarding_project_member(project_id))
  WITH CHECK (is_onboarding_project_member(project_id));
CREATE POLICY "Staff can access forecasts" ON public.client_crm_forecasts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- =====================================================
-- TRIGGERS for updated_at
-- =====================================================
CREATE TRIGGER update_client_crm_leads_updated_at
  BEFORE UPDATE ON public.client_crm_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_crm_lead_activities_updated_at
  BEFORE UPDATE ON public.client_crm_lead_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_crm_stage_checklists_updated_at
  BEFORE UPDATE ON public.client_crm_stage_checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_crm_transcriptions_updated_at
  BEFORE UPDATE ON public.client_crm_transcriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_crm_forecasts_updated_at
  BEFORE UPDATE ON public.client_crm_forecasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Function: Update lead activity dates automatically
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_client_crm_lead_activity_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_activity_at
  UPDATE client_crm_leads 
  SET last_activity_at = now(),
      updated_at = now()
  WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
  
  -- Update next_activity_at
  UPDATE client_crm_leads 
  SET next_activity_at = (
    SELECT MIN(scheduled_at) 
    FROM client_crm_lead_activities 
    WHERE lead_id = COALESCE(NEW.lead_id, OLD.lead_id) 
    AND status = 'pending' 
    AND scheduled_at > now()
  )
  WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_client_lead_activity_dates
  AFTER INSERT OR UPDATE ON public.client_crm_lead_activities
  FOR EACH ROW EXECUTE FUNCTION update_client_crm_lead_activity_dates();

-- =====================================================
-- Function: Log stage changes to history
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_client_crm_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO client_crm_lead_history (lead_id, action, field_changed, old_value, new_value)
    VALUES (NEW.id, 'stage_change', 'stage_id', OLD.stage_id::text, NEW.stage_id::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_log_client_crm_stage_change
  AFTER UPDATE ON public.client_crm_leads
  FOR EACH ROW EXECUTE FUNCTION log_client_crm_stage_change();
