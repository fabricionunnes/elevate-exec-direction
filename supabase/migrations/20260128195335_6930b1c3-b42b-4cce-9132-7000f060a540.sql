
-- =====================================================
-- MANUAL DE CULTURA - COMPLETE DATABASE STRUCTURE
-- =====================================================

-- Culture form links (public access per project)
CREATE TABLE public.culture_form_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.onboarding_staff(id),
  expires_at TIMESTAMPTZ,
  UNIQUE(project_id)
);

-- Culture form responses (entrepreneur answers)
CREATE TABLE public.culture_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  form_link_id UUID REFERENCES public.culture_form_links(id) ON DELETE SET NULL,
  respondent_name TEXT,
  respondent_role TEXT,
  respondent_email TEXT,
  
  -- Identity & History
  company_history TEXT,
  founding_story TEXT,
  founders_motivation TEXT,
  
  -- Purpose & Mission
  company_purpose TEXT,
  mission_statement TEXT,
  vision_statement TEXT,
  core_values TEXT,
  
  -- Culture & Behavior
  cultural_principles TEXT,
  expected_behaviors TEXT,
  unacceptable_behaviors TEXT,
  
  -- Leadership
  leadership_style TEXT,
  leadership_expectations TEXT,
  
  -- Performance
  performance_culture TEXT,
  recognition_approach TEXT,
  meritocracy_principles TEXT,
  
  -- Communication
  communication_style TEXT,
  internal_communication TEXT,
  
  -- Clients
  client_relationship TEXT,
  client_experience_vision TEXT,
  
  -- People
  ideal_team_member TEXT,
  who_should_not_join TEXT,
  growth_opportunities TEXT,
  
  -- Future
  company_future_vision TEXT,
  legacy_aspiration TEXT,
  final_leadership_message TEXT,
  
  -- Metadata
  additional_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  is_complete BOOLEAN DEFAULT false
);

-- Culture manual versions (versioning system)
CREATE TABLE public.culture_manual_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  version_name TEXT,
  is_active BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  generated_by_ai BOOLEAN DEFAULT false,
  
  -- Company branding
  company_logo_url TEXT,
  primary_color TEXT DEFAULT '#1e3a5f',
  secondary_color TEXT DEFAULT '#c41e3a',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.onboarding_staff(id),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES public.onboarding_staff(id),
  notes TEXT,
  
  UNIQUE(project_id, version_number)
);

-- Culture manual sections (content per version)
CREATE TABLE public.culture_manual_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.culture_manual_versions(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_title TEXT NOT NULL,
  section_content TEXT,
  sort_order INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT false,
  locked_by UUID REFERENCES public.onboarding_staff(id),
  locked_at TIMESTAMPTZ,
  last_edited_at TIMESTAMPTZ DEFAULT now(),
  last_edited_by UUID REFERENCES public.onboarding_staff(id),
  
  UNIQUE(version_id, section_key)
);

-- Culture manual audit log (history tracking)
CREATE TABLE public.culture_manual_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.culture_manual_versions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  action_details JSONB,
  performed_by_staff_id UUID REFERENCES public.onboarding_staff(id),
  performed_by_user_id UUID REFERENCES public.onboarding_users(id),
  performed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT
);

-- Enable RLS
ALTER TABLE public.culture_form_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.culture_form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.culture_manual_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.culture_manual_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.culture_manual_audit_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- culture_form_links: Staff can manage, public can read with token
CREATE POLICY "Staff can view culture form links"
ON public.culture_form_links FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can insert culture form links"
ON public.culture_form_links FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND os.role IN ('admin', 'consultant', 'cs')
  )
);

CREATE POLICY "Staff can update culture form links"
ON public.culture_form_links FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND os.role IN ('admin', 'consultant', 'cs')
  )
);

-- Public can read active form links by token
CREATE POLICY "Public can view active form links by token"
ON public.culture_form_links FOR SELECT
TO anon
USING (is_active = true);

-- culture_form_responses: Staff full access, public can insert
CREATE POLICY "Staff can view form responses"
ON public.culture_form_responses FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can manage form responses"
ON public.culture_form_responses FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND os.role IN ('admin', 'consultant', 'cs')
  )
);

CREATE POLICY "Public can submit form responses"
ON public.culture_form_responses FOR INSERT
TO anon
WITH CHECK (true);

-- culture_manual_versions: Staff can manage, clients can read published
CREATE POLICY "Staff can manage manual versions"
ON public.culture_manual_versions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Clients can view published versions"
ON public.culture_manual_versions FOR SELECT
TO authenticated
USING (
  is_published = true AND
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid() AND ou.project_id = project_id
  )
);

-- culture_manual_sections: Staff can manage, clients can read from published versions
CREATE POLICY "Staff can manage manual sections"
ON public.culture_manual_sections FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Clients can view sections from published versions"
ON public.culture_manual_sections FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.culture_manual_versions v
    JOIN public.onboarding_users ou ON ou.project_id = v.project_id
    WHERE v.id = version_id
    AND v.is_published = true
    AND ou.user_id = auth.uid()
  )
);

-- culture_manual_audit_log: Staff only
CREATE POLICY "Staff can view audit log"
ON public.culture_manual_audit_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can insert audit log"
ON public.culture_manual_audit_log FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Public can insert audit log for form submissions
CREATE POLICY "Public can log form submissions"
ON public.culture_manual_audit_log FOR INSERT
TO anon
WITH CHECK (action = 'form_submitted');

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_culture_form_links_project ON public.culture_form_links(project_id);
CREATE INDEX idx_culture_form_links_token ON public.culture_form_links(access_token);
CREATE INDEX idx_culture_form_responses_project ON public.culture_form_responses(project_id);
CREATE INDEX idx_culture_manual_versions_project ON public.culture_manual_versions(project_id);
CREATE INDEX idx_culture_manual_versions_active ON public.culture_manual_versions(project_id, is_active);
CREATE INDEX idx_culture_manual_sections_version ON public.culture_manual_sections(version_id);
CREATE INDEX idx_culture_manual_audit_project ON public.culture_manual_audit_log(project_id);

-- =====================================================
-- TRIGGER: Auto-increment version number
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_increment_culture_version()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO NEW.version_number
  FROM public.culture_manual_versions
  WHERE project_id = NEW.project_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_auto_increment_culture_version
BEFORE INSERT ON public.culture_manual_versions
FOR EACH ROW
EXECUTE FUNCTION public.auto_increment_culture_version();

-- =====================================================
-- TRIGGER: Deactivate other versions when one is activated
-- =====================================================

CREATE OR REPLACE FUNCTION public.ensure_single_active_culture_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.culture_manual_versions
    SET is_active = false
    WHERE project_id = NEW.project_id AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_ensure_single_active_culture_version
AFTER INSERT OR UPDATE OF is_active ON public.culture_manual_versions
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION public.ensure_single_active_culture_version();
