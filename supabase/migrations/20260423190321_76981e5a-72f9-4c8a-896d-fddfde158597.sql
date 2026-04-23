-- ============================================================
-- UNV PROFILE — Módulo completo de RH / Gestão de Pessoas
-- Multi-tenant via tenant_id (NULL = master UNV)
-- ============================================================

-- =================== HELPERS ===================
CREATE OR REPLACE FUNCTION public.current_staff_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.onboarding_staff
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.onboarding_staff
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_profile_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('master','admin','rh','head_comercial')
  );
$$;

-- =================== 1. EMPRESAS DO PROFILE ===================
CREATE TABLE IF NOT EXISTS public.profile_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  onboarding_company_id uuid REFERENCES public.onboarding_companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  cnpj text,
  industry text,
  size text,
  is_internal boolean NOT NULL DEFAULT false,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read profile_companies" ON public.profile_companies FOR SELECT
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());
CREATE POLICY "admin write profile_companies" ON public.profile_companies FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id() AND public.is_profile_admin())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id() AND public.is_profile_admin());

-- =================== 2. CARGOS / DEPARTAMENTOS ===================
CREATE TABLE IF NOT EXISTS public.profile_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.profile_companies(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.profile_departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw profile_departments" ON public.profile_departments FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

CREATE TABLE IF NOT EXISTS public.profile_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.profile_companies(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.profile_departments(id) ON DELETE SET NULL,
  title text NOT NULL,
  level text,
  salary_min numeric,
  salary_max numeric,
  competencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw profile_positions" ON public.profile_positions FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

-- =================== 3. COLABORADORES ===================
CREATE TABLE IF NOT EXISTS public.profile_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.profile_companies(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  user_id uuid,
  full_name text NOT NULL,
  email text,
  phone text,
  cpf text,
  birth_date date,
  avatar_url text,
  position_id uuid REFERENCES public.profile_positions(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.profile_departments(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.profile_employees(id) ON DELETE SET NULL,
  employee_type text NOT NULL DEFAULT 'internal', -- internal | client
  contract_type text, -- CLT | PJ | Estagio | Freelancer
  status text NOT NULL DEFAULT 'active', -- active | inactive | onboarding | terminated
  is_employee boolean NOT NULL DEFAULT true,
  hire_date date,
  termination_date date,
  salary numeric,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_employees_tenant ON public.profile_employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profile_employees_staff ON public.profile_employees(staff_id);
CREATE INDEX IF NOT EXISTS idx_profile_employees_company ON public.profile_employees(company_id);
ALTER TABLE public.profile_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read profile_employees" ON public.profile_employees FOR SELECT
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());
CREATE POLICY "admin write profile_employees" ON public.profile_employees FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id() AND public.is_profile_admin())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id() AND public.is_profile_admin());

-- =================== SYNC STAFF -> PROFILE_EMPLOYEES ===================
CREATE OR REPLACE FUNCTION public.sync_staff_to_profile_employee()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.profile_employees SET status = 'terminated', is_employee = false, updated_at = now()
    WHERE staff_id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.profile_employees (tenant_id, staff_id, user_id, full_name, email, phone, avatar_url, employee_type, status, is_employee)
  VALUES (NEW.tenant_id, NEW.id, NEW.user_id, NEW.name, NEW.email, NEW.phone, NEW.avatar_url, 'internal',
          CASE WHEN NEW.is_active THEN 'active' ELSE 'inactive' END, true)
  ON CONFLICT DO NOTHING;

  UPDATE public.profile_employees
  SET full_name = NEW.name,
      email = NEW.email,
      phone = NEW.phone,
      avatar_url = NEW.avatar_url,
      tenant_id = NEW.tenant_id,
      user_id = NEW.user_id,
      status = CASE WHEN NEW.is_active THEN COALESCE(NULLIF(status,'inactive'),'active') ELSE 'inactive' END,
      updated_at = now()
  WHERE staff_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_staff_to_profile ON public.onboarding_staff;
CREATE TRIGGER trg_sync_staff_to_profile
AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_staff
FOR EACH ROW EXECUTE FUNCTION public.sync_staff_to_profile_employee();

-- Backfill colaboradores a partir do staff existente
INSERT INTO public.profile_employees (tenant_id, staff_id, user_id, full_name, email, phone, avatar_url, employee_type, status, is_employee)
SELECT tenant_id, id, user_id, name, email, phone, avatar_url, 'internal',
       CASE WHEN is_active THEN 'active' ELSE 'inactive' END, true
FROM public.onboarding_staff
WHERE NOT EXISTS (SELECT 1 FROM public.profile_employees pe WHERE pe.staff_id = onboarding_staff.id);

-- =================== 4. VÍNCULOS COLABORADOR <-> EMPRESA (múltiplos) ===================
CREATE TABLE IF NOT EXISTS public.profile_employee_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profile_employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.profile_companies(id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'employee',
  is_primary boolean NOT NULL DEFAULT false,
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_employee_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw profile_employee_links" ON public.profile_employee_links FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

-- =================== 5. RECRUTAMENTO — VAGAS PROFILE ===================
CREATE TABLE IF NOT EXISTS public.profile_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.profile_companies(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.profile_positions(id) ON DELETE SET NULL,
  title text NOT NULL,
  area text,
  seniority text,
  contract_model text,
  salary_min numeric,
  salary_max numeric,
  description text,
  requirements text,
  competencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  city text,
  state text,
  is_remote boolean NOT NULL DEFAULT false,
  recruiter_id uuid REFERENCES public.profile_employees(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.profile_employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open', -- open|paused|closed|filled
  custom_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  public_token text UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read profile_jobs" ON public.profile_jobs FOR SELECT
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());
CREATE POLICY "public read open profile_jobs by token" ON public.profile_jobs FOR SELECT
  USING (status = 'open' AND public_token IS NOT NULL);
CREATE POLICY "admin write profile_jobs" ON public.profile_jobs FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id() AND public.is_profile_admin())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id() AND public.is_profile_admin());

-- =================== 6. CANDIDATOS PROFILE ===================
CREATE TABLE IF NOT EXISTS public.profile_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.profile_jobs(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  city text,
  state text,
  resume_url text,
  video_url text,
  linkedin_url text,
  cover_letter text,
  custom_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text DEFAULT 'public_form',
  stage text NOT NULL DEFAULT 'applied', -- applied|screening|test|hr_interview|manager_interview|offer|hired|rejected|talent_pool
  status text NOT NULL DEFAULT 'active',
  ai_score int,
  ai_summary text,
  ai_strengths jsonb,
  ai_concerns jsonb,
  tags text[] DEFAULT '{}',
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read profile_candidates" ON public.profile_candidates FOR SELECT
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());
CREATE POLICY "public insert candidates via job token" ON public.profile_candidates FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profile_jobs j WHERE j.id = job_id AND j.status='open'));
CREATE POLICY "admin write profile_candidates" ON public.profile_candidates FOR UPDATE
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id() AND public.is_profile_admin());
CREATE POLICY "admin delete profile_candidates" ON public.profile_candidates FOR DELETE
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id() AND public.is_profile_admin());

CREATE TABLE IF NOT EXISTS public.profile_candidate_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  candidate_id uuid NOT NULL REFERENCES public.profile_candidates(id) ON DELETE CASCADE,
  author_id uuid,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_candidate_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw candidate notes" ON public.profile_candidate_notes FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

-- =================== 7. DISC ===================
CREATE TABLE IF NOT EXISTS public.profile_disc_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.profile_employees(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.profile_candidates(id) ON DELETE CASCADE,
  d_score int, i_score int, s_score int, c_score int,
  dominant text,
  interpretation text,
  raw_responses jsonb,
  taken_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_disc_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw disc" ON public.profile_disc_results FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

-- =================== 8. ONBOARDING ===================
CREATE TABLE IF NOT EXISTS public.profile_onboarding_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.profile_companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  template jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_onboarding_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw onboarding tracks" ON public.profile_onboarding_tracks FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

CREATE TABLE IF NOT EXISTS public.profile_onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profile_employees(id) ON DELETE CASCADE,
  track_id uuid REFERENCES public.profile_onboarding_tracks(id) ON DELETE SET NULL,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  feedback_7 text, feedback_15 text, feedback_30 text, feedback_45 text, feedback_90 text
);
ALTER TABLE public.profile_onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw onboarding progress" ON public.profile_onboarding_progress FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

-- =================== 9. PDI ===================
CREATE TABLE IF NOT EXISTS public.profile_pdi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profile_employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  responsible_id uuid REFERENCES public.profile_employees(id),
  due_date date,
  status text NOT NULL DEFAULT 'open',
  ai_suggested boolean NOT NULL DEFAULT false,
  evidences jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_pdi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw pdi" ON public.profile_pdi FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

-- =================== 10. PLANO DE CARREIRA ===================
CREATE TABLE IF NOT EXISTS public.profile_career_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.profile_companies(id) ON DELETE CASCADE,
  area text,
  name text NOT NULL,
  levels jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{name, criteria, competencies, min_months, salary_range}]
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_career_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw career" ON public.profile_career_tracks FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

-- =================== 11. AVALIAÇÕES ===================
CREATE TABLE IF NOT EXISTS public.profile_evaluation_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT '90', -- self|manager|90|180|360
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_date date, end_date date,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_evaluation_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw eval cycles" ON public.profile_evaluation_cycles FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

CREATE TABLE IF NOT EXISTS public.profile_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  cycle_id uuid REFERENCES public.profile_evaluation_cycles(id) ON DELETE CASCADE,
  evaluated_id uuid REFERENCES public.profile_employees(id) ON DELETE CASCADE,
  evaluator_id uuid REFERENCES public.profile_employees(id) ON DELETE SET NULL,
  evaluator_role text, -- self|manager|peer|subordinate
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_score numeric,
  comments text,
  ai_recommendation text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw evaluations" ON public.profile_evaluations FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

-- =================== 12. FEEDBACKS / 1:1 ===================
CREATE TABLE IF NOT EXISTS public.profile_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  from_id uuid REFERENCES public.profile_employees(id) ON DELETE SET NULL,
  to_id uuid REFERENCES public.profile_employees(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'continuous', -- continuous|1on1|recognition
  content text NOT NULL,
  action_plan text,
  meeting_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw feedbacks" ON public.profile_feedbacks FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

-- =================== 13. TREINAMENTOS ===================
CREATE TABLE IF NOT EXISTS public.profile_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.profile_companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  content_url text,
  duration_minutes int,
  has_quiz boolean DEFAULT false,
  is_required boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_trainings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw trainings" ON public.profile_trainings FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

CREATE TABLE IF NOT EXISTS public.profile_training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  training_id uuid NOT NULL REFERENCES public.profile_trainings(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profile_employees(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  score int,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_training_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw training progress" ON public.profile_training_progress FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

-- =================== 14. CLIMA & ENGAJAMENTO ===================
CREATE TABLE IF NOT EXISTS public.profile_climate_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.profile_companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'pulse', -- pulse|enps|climate
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  starts_at timestamptz, ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_climate_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw climate" ON public.profile_climate_surveys FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

CREATE TABLE IF NOT EXISTS public.profile_climate_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  survey_id uuid NOT NULL REFERENCES public.profile_climate_surveys(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.profile_employees(id),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  enps_score int,
  is_anonymous boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_climate_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rw climate responses" ON public.profile_climate_responses FOR ALL
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());

-- =================== 15. LOGS / HISTÓRICO ===================
CREATE TABLE IF NOT EXISTS public.profile_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read log" ON public.profile_activity_log FOR SELECT
  USING (tenant_id IS NOT DISTINCT FROM public.current_staff_tenant_id());
CREATE POLICY "any insert log" ON public.profile_activity_log FOR INSERT
  WITH CHECK (true);

-- =================== UPDATE_AT triggers ===================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'profile_companies','profile_positions','profile_employees',
    'profile_jobs','profile_candidates','profile_pdi'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_%1$s ON public.%1$s; CREATE TRIGGER trg_touch_%1$s BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t);
  END LOOP;
END $$;