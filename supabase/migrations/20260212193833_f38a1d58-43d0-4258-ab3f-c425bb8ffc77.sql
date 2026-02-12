
-- ============================================
-- APPOINTMENTS MODULE - DATABASE SCHEMA
-- ============================================

-- 1) Service Categories
CREATE TABLE public.appointment_service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Clients/Patients
CREATE TABLE public.appointment_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  email TEXT,
  birth_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_appointment_clients_cpf ON public.appointment_clients(project_id, cpf) WHERE cpf IS NOT NULL AND cpf != '';

-- 3) Services/Procedures
CREATE TABLE public.appointment_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.appointment_service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 60,
  price NUMERIC(12,2) DEFAULT 0,
  allows_packages BOOLEAN DEFAULT false,
  sessions_per_package INT,
  pre_instructions TEXT,
  post_instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Professionals
CREATE TABLE public.appointment_professionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT,
  commission_percent NUMERIC(5,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) Professional <-> Service mapping
CREATE TABLE public.appointment_professional_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.appointment_professionals(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.appointment_services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(professional_id, service_id)
);

-- 6) Resources (rooms, equipment)
CREATE TABLE public.appointment_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'room', -- 'room' | 'equipment'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) Resource <-> Service mapping
CREATE TABLE public.appointment_resource_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES public.appointment_resources(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.appointment_services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(resource_id, service_id)
);

-- 8) Availability schedules (for professionals and resources)
CREATE TABLE public.appointment_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.appointment_professionals(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES public.appointment_resources(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL, -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9) Main appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.appointment_clients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.appointment_services(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.appointment_professionals(id) ON DELETE SET NULL,
  resource_id UUID REFERENCES public.appointment_resources(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  price NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, confirmed, attended, cancelled, no_show
  notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_project_start ON public.appointments(project_id, start_time);
CREATE INDEX idx_appointments_professional ON public.appointments(professional_id, start_time);
CREATE INDEX idx_appointments_resource ON public.appointments(resource_id, start_time);
CREATE INDEX idx_appointments_client ON public.appointments(client_id);

-- 10) Appointment logs/history
CREATE TABLE public.appointment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- created, updated, status_changed, cancelled
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  performed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11) Module settings per project
CREATE TABLE public.appointment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT,
  slot_interval_minutes INT DEFAULT 30,
  allow_overlap BOOLEAN DEFAULT false,
  working_hours_start TIME DEFAULT '08:00',
  working_hours_end TIME DEFAULT '20:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Helper function: check if user is a project client (can edit)
CREATE OR REPLACE FUNCTION public.is_appointment_project_client(check_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_users
    WHERE project_id = check_project_id
    AND user_id = auth.uid()
    AND role = 'client'
  )
$$;

-- Helper function: check if user has any access to project (view)
CREATE OR REPLACE FUNCTION public.has_appointment_access(check_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    -- Client user
    SELECT 1 FROM public.onboarding_users
    WHERE project_id = check_project_id AND user_id = auth.uid()
  ) OR EXISTS (
    -- Staff member (admin/cs/consultant)
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND (
      os.role IN ('admin', 'master')
      OR EXISTS (
        SELECT 1 FROM public.onboarding_companies oc
        JOIN public.onboarding_projects op ON op.onboarding_company_id = oc.id
        WHERE op.id = check_project_id
        AND (oc.consultant_id = os.id OR oc.cs_id = os.id)
      )
    )
  )
$$;

-- Enable RLS on all tables
ALTER TABLE public.appointment_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_resource_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_settings ENABLE ROW LEVEL SECURITY;

-- === SELECT policies (view access for all project members) ===
CREATE POLICY "view_appointment_service_categories" ON public.appointment_service_categories FOR SELECT USING (public.has_appointment_access(project_id));
CREATE POLICY "view_appointment_clients" ON public.appointment_clients FOR SELECT USING (public.has_appointment_access(project_id));
CREATE POLICY "view_appointment_services" ON public.appointment_services FOR SELECT USING (public.has_appointment_access(project_id));
CREATE POLICY "view_appointment_professionals" ON public.appointment_professionals FOR SELECT USING (public.has_appointment_access(project_id));
CREATE POLICY "view_appointment_professional_services" ON public.appointment_professional_services FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.appointment_professionals p WHERE p.id = professional_id AND public.has_appointment_access(p.project_id))
);
CREATE POLICY "view_appointment_resources" ON public.appointment_resources FOR SELECT USING (public.has_appointment_access(project_id));
CREATE POLICY "view_appointment_resource_services" ON public.appointment_resource_services FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.appointment_resources r WHERE r.id = resource_id AND public.has_appointment_access(r.project_id))
);
CREATE POLICY "view_appointment_schedules" ON public.appointment_schedules FOR SELECT USING (public.has_appointment_access(project_id));
CREATE POLICY "view_appointments" ON public.appointments FOR SELECT USING (public.has_appointment_access(project_id));
CREATE POLICY "view_appointment_logs" ON public.appointment_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND public.has_appointment_access(a.project_id))
);
CREATE POLICY "view_appointment_settings" ON public.appointment_settings FOR SELECT USING (public.has_appointment_access(project_id));

-- === INSERT policies (client only) ===
CREATE POLICY "insert_appointment_service_categories" ON public.appointment_service_categories FOR INSERT WITH CHECK (public.is_appointment_project_client(project_id));
CREATE POLICY "insert_appointment_clients" ON public.appointment_clients FOR INSERT WITH CHECK (public.is_appointment_project_client(project_id));
CREATE POLICY "insert_appointment_services" ON public.appointment_services FOR INSERT WITH CHECK (public.is_appointment_project_client(project_id));
CREATE POLICY "insert_appointment_professionals" ON public.appointment_professionals FOR INSERT WITH CHECK (public.is_appointment_project_client(project_id));
CREATE POLICY "insert_appointment_professional_services" ON public.appointment_professional_services FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.appointment_professionals p WHERE p.id = professional_id AND public.is_appointment_project_client(p.project_id))
);
CREATE POLICY "insert_appointment_resources" ON public.appointment_resources FOR INSERT WITH CHECK (public.is_appointment_project_client(project_id));
CREATE POLICY "insert_appointment_resource_services" ON public.appointment_resource_services FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.appointment_resources r WHERE r.id = resource_id AND public.is_appointment_project_client(r.project_id))
);
CREATE POLICY "insert_appointment_schedules" ON public.appointment_schedules FOR INSERT WITH CHECK (public.is_appointment_project_client(project_id));
CREATE POLICY "insert_appointments" ON public.appointments FOR INSERT WITH CHECK (public.is_appointment_project_client(project_id));
CREATE POLICY "insert_appointment_logs" ON public.appointment_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND public.is_appointment_project_client(a.project_id))
);
CREATE POLICY "insert_appointment_settings" ON public.appointment_settings FOR INSERT WITH CHECK (public.is_appointment_project_client(project_id));

-- === UPDATE policies (client only) ===
CREATE POLICY "update_appointment_service_categories" ON public.appointment_service_categories FOR UPDATE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "update_appointment_clients" ON public.appointment_clients FOR UPDATE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "update_appointment_services" ON public.appointment_services FOR UPDATE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "update_appointment_professionals" ON public.appointment_professionals FOR UPDATE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "update_appointment_resources" ON public.appointment_resources FOR UPDATE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "update_appointment_schedules" ON public.appointment_schedules FOR UPDATE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "update_appointments" ON public.appointments FOR UPDATE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "update_appointment_settings" ON public.appointment_settings FOR UPDATE USING (public.is_appointment_project_client(project_id));

-- === DELETE policies (client only) ===
CREATE POLICY "delete_appointment_service_categories" ON public.appointment_service_categories FOR DELETE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "delete_appointment_clients" ON public.appointment_clients FOR DELETE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "delete_appointment_services" ON public.appointment_services FOR DELETE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "delete_appointment_professionals" ON public.appointment_professionals FOR DELETE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "delete_appointment_professional_services" ON public.appointment_professional_services FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.appointment_professionals p WHERE p.id = professional_id AND public.is_appointment_project_client(p.project_id))
);
CREATE POLICY "delete_appointment_resources" ON public.appointment_resources FOR DELETE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "delete_appointment_resource_services" ON public.appointment_resource_services FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.appointment_resources r WHERE r.id = resource_id AND public.is_appointment_project_client(r.project_id))
);
CREATE POLICY "delete_appointment_schedules" ON public.appointment_schedules FOR DELETE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "delete_appointments" ON public.appointments FOR DELETE USING (public.is_appointment_project_client(project_id));
CREATE POLICY "delete_appointment_logs" ON public.appointment_logs FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND public.is_appointment_project_client(a.project_id))
);
CREATE POLICY "delete_appointment_settings" ON public.appointment_settings FOR DELETE USING (public.is_appointment_project_client(project_id));

-- Triggers for updated_at
CREATE TRIGGER update_appointment_service_categories_updated_at BEFORE UPDATE ON public.appointment_service_categories FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();
CREATE TRIGGER update_appointment_clients_updated_at BEFORE UPDATE ON public.appointment_clients FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();
CREATE TRIGGER update_appointment_services_updated_at BEFORE UPDATE ON public.appointment_services FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();
CREATE TRIGGER update_appointment_professionals_updated_at BEFORE UPDATE ON public.appointment_professionals FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();
CREATE TRIGGER update_appointment_resources_updated_at BEFORE UPDATE ON public.appointment_resources FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();
CREATE TRIGGER update_appointment_settings_updated_at BEFORE UPDATE ON public.appointment_settings FOR EACH ROW EXECUTE FUNCTION public.portal_update_updated_at();
