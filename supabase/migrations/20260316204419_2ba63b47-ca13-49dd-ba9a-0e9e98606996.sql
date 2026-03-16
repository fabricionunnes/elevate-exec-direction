
-- Client CRM: Independent pipelines per project
CREATE TABLE public.client_crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Client CRM: Stages per pipeline
CREATE TABLE public.client_crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.client_crm_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  sort_order integer DEFAULT 0,
  is_final boolean DEFAULT false,
  final_type text, -- 'won' or 'lost'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Client CRM: Contacts (independent from staff CRM)
CREATE TABLE public.client_crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  role text,
  document text,
  notes text,
  tags text[],
  created_by uuid REFERENCES public.onboarding_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Client CRM: Deals/Negócios
CREATE TABLE public.client_crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.client_crm_pipelines(id),
  stage_id uuid REFERENCES public.client_crm_stages(id),
  contact_id uuid REFERENCES public.client_crm_contacts(id),
  title text NOT NULL,
  value numeric DEFAULT 0,
  notes text,
  probability integer DEFAULT 50,
  expected_close_date date,
  closed_at timestamptz,
  loss_reason text,
  created_by uuid REFERENCES public.onboarding_users(id),
  owner_id uuid REFERENCES public.onboarding_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Client CRM: Activities
CREATE TABLE public.client_crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.client_crm_deals(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.client_crm_contacts(id),
  type text NOT NULL DEFAULT 'task', -- task, call, meeting, email, note
  title text NOT NULL,
  description text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  status text DEFAULT 'pending', -- pending, completed, cancelled
  created_by uuid REFERENCES public.onboarding_users(id),
  assigned_to uuid REFERENCES public.onboarding_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Client CRM: WhatsApp instance config (per project)
CREATE TABLE public.client_crm_whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE UNIQUE,
  instance_name text,
  instance_id text,
  server_url text,
  api_key text,
  status text DEFAULT 'disconnected', -- connected, disconnected, connecting
  qr_code text,
  connected_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_crm_whatsapp_config ENABLE ROW LEVEL SECURITY;

-- RLS: Project members can access their own project's data
CREATE POLICY "Project members can manage pipelines"
  ON public.client_crm_pipelines FOR ALL
  TO authenticated
  USING (public.is_onboarding_project_member(project_id))
  WITH CHECK (public.is_onboarding_project_member(project_id));

CREATE POLICY "Project members can manage stages"
  ON public.client_crm_stages FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_crm_pipelines p 
    WHERE p.id = pipeline_id AND public.is_onboarding_project_member(p.project_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.client_crm_pipelines p 
    WHERE p.id = pipeline_id AND public.is_onboarding_project_member(p.project_id)
  ));

CREATE POLICY "Project members can manage contacts"
  ON public.client_crm_contacts FOR ALL
  TO authenticated
  USING (public.is_onboarding_project_member(project_id))
  WITH CHECK (public.is_onboarding_project_member(project_id));

CREATE POLICY "Project members can manage deals"
  ON public.client_crm_deals FOR ALL
  TO authenticated
  USING (public.is_onboarding_project_member(project_id))
  WITH CHECK (public.is_onboarding_project_member(project_id));

CREATE POLICY "Project members can manage activities"
  ON public.client_crm_activities FOR ALL
  TO authenticated
  USING (public.is_onboarding_project_member(project_id))
  WITH CHECK (public.is_onboarding_project_member(project_id));

CREATE POLICY "Project members can manage whatsapp config"
  ON public.client_crm_whatsapp_config FOR ALL
  TO authenticated
  USING (public.is_onboarding_project_member(project_id))
  WITH CHECK (public.is_onboarding_project_member(project_id));

-- Staff can also access (for admin purposes)
CREATE POLICY "Staff can access pipelines"
  ON public.client_crm_pipelines FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can access stages"
  ON public.client_crm_stages FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can access contacts"
  ON public.client_crm_contacts FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can access deals"
  ON public.client_crm_deals FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can access activities"
  ON public.client_crm_activities FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can access whatsapp config"
  ON public.client_crm_whatsapp_config FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- Create default pipeline function
CREATE OR REPLACE FUNCTION public.create_default_client_crm_pipeline(p_project_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pipeline_id uuid;
BEGIN
  -- Check if pipeline already exists
  SELECT id INTO v_pipeline_id FROM client_crm_pipelines 
  WHERE project_id = p_project_id AND is_default = true LIMIT 1;
  
  IF v_pipeline_id IS NOT NULL THEN
    RETURN v_pipeline_id;
  END IF;

  -- Create default pipeline
  INSERT INTO client_crm_pipelines (project_id, name, description, is_default)
  VALUES (p_project_id, 'Pipeline Padrão', 'Pipeline padrão de vendas', true)
  RETURNING id INTO v_pipeline_id;

  -- Create default stages
  INSERT INTO client_crm_stages (pipeline_id, name, color, sort_order, is_final, final_type) VALUES
    (v_pipeline_id, 'Novo Lead', '#6366f1', 0, false, null),
    (v_pipeline_id, 'Qualificação', '#8b5cf6', 1, false, null),
    (v_pipeline_id, 'Proposta', '#f59e0b', 2, false, null),
    (v_pipeline_id, 'Negociação', '#f97316', 3, false, null),
    (v_pipeline_id, 'Ganho', '#22c55e', 4, true, 'won'),
    (v_pipeline_id, 'Perdido', '#ef4444', 5, true, 'lost');

  RETURN v_pipeline_id;
END;
$$;
