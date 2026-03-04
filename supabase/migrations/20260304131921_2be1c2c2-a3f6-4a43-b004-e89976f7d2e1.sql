
-- Routine Contract Form Links (public access tokens)
CREATE TABLE public.routine_form_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.onboarding_projects(id) ON DELETE CASCADE NOT NULL,
  access_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.onboarding_staff(id),
  expires_at timestamptz
);

-- Routine Form Responses (from public form)
CREATE TABLE public.routine_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.onboarding_projects(id) ON DELETE CASCADE NOT NULL,
  form_link_id uuid REFERENCES public.routine_form_links(id),
  employee_name text NOT NULL,
  employee_role text,
  employee_department text,
  employee_tenure text,
  daily_activities text,
  most_important_activities text,
  time_per_activity text,
  weekly_activities text,
  weekly_activities_list text,
  daily_contacts integer,
  weekly_meetings integer,
  monthly_sales integer,
  main_responsibilities text,
  main_challenges text,
  productivity_suggestions text,
  submitted_at timestamptz DEFAULT now(),
  is_processed boolean DEFAULT false
);

-- Routine Contracts (generated contracts)
CREATE TABLE public.routine_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.onboarding_projects(id) ON DELETE CASCADE NOT NULL,
  form_response_id uuid REFERENCES public.routine_form_responses(id),
  employee_name text NOT NULL,
  employee_role text,
  employee_department text,
  direct_manager text,
  introduction text,
  daily_routine jsonb DEFAULT '[]'::jsonb,
  weekly_routine jsonb DEFAULT '[]'::jsonb,
  performance_indicators jsonb DEFAULT '[]'::jsonb,
  responsibilities text,
  observations text,
  version_number integer DEFAULT 1,
  status text DEFAULT 'draft',
  generated_by_ai boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now()
);

-- Routine PDF Exports
CREATE TABLE public.routine_pdf_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.routine_contracts(id) ON DELETE CASCADE NOT NULL,
  pdf_url text,
  generated_at timestamptz DEFAULT now(),
  generated_by uuid
);

-- Enable RLS
ALTER TABLE public.routine_form_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_pdf_exports ENABLE ROW LEVEL SECURITY;

-- Form links: public read by token, staff/admin manage
CREATE POLICY "Public can read active form links by token"
ON public.routine_form_links FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can manage form links"
ON public.routine_form_links FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true)
  OR EXISTS (SELECT 1 FROM onboarding_users ou WHERE ou.user_id = auth.uid() AND ou.project_id = routine_form_links.project_id AND ou.role IN ('admin', 'gerente'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true)
  OR EXISTS (SELECT 1 FROM onboarding_users ou WHERE ou.user_id = auth.uid() AND ou.project_id = routine_form_links.project_id AND ou.role IN ('admin', 'gerente'))
);

-- Form responses: anyone can insert (public form), staff/admin read
CREATE POLICY "Anyone can submit form responses"
ON public.routine_form_responses FOR INSERT
WITH CHECK (true);

CREATE POLICY "Staff and users can read responses"
ON public.routine_form_responses FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true)
  OR EXISTS (SELECT 1 FROM onboarding_users ou WHERE ou.user_id = auth.uid() AND ou.project_id = routine_form_responses.project_id AND ou.role IN ('admin', 'gerente', 'client'))
);

CREATE POLICY "Staff can update responses"
ON public.routine_form_responses FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true)
);

-- Contracts: staff/admin full, client read
CREATE POLICY "Staff can manage contracts"
ON public.routine_contracts FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true)
  OR EXISTS (SELECT 1 FROM onboarding_users ou WHERE ou.user_id = auth.uid() AND ou.project_id = routine_contracts.project_id AND ou.role IN ('admin', 'gerente'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true)
  OR EXISTS (SELECT 1 FROM onboarding_users ou WHERE ou.user_id = auth.uid() AND ou.project_id = routine_contracts.project_id AND ou.role IN ('admin', 'gerente'))
);

CREATE POLICY "Clients can view contracts"
ON public.routine_contracts FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM onboarding_users ou WHERE ou.user_id = auth.uid() AND ou.project_id = routine_contracts.project_id AND ou.role = 'client')
);

-- PDF exports: same as contracts
CREATE POLICY "Staff can manage pdf exports"
ON public.routine_pdf_exports FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM routine_contracts rc
    JOIN onboarding_staff os ON os.user_id = auth.uid() AND os.is_active = true
    WHERE rc.id = routine_pdf_exports.contract_id
  )
  OR EXISTS (
    SELECT 1 FROM routine_contracts rc
    JOIN onboarding_users ou ON ou.user_id = auth.uid() AND ou.project_id = rc.project_id AND ou.role IN ('admin', 'gerente')
    WHERE rc.id = routine_pdf_exports.contract_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM routine_contracts rc
    JOIN onboarding_staff os ON os.user_id = auth.uid() AND os.is_active = true
    WHERE rc.id = routine_pdf_exports.contract_id
  )
  OR EXISTS (
    SELECT 1 FROM routine_contracts rc
    JOIN onboarding_users ou ON ou.user_id = auth.uid() AND ou.project_id = rc.project_id AND ou.role IN ('admin', 'gerente')
    WHERE rc.id = routine_pdf_exports.contract_id
  )
);

CREATE POLICY "Clients can view pdf exports"
ON public.routine_pdf_exports FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM routine_contracts rc
    JOIN onboarding_users ou ON ou.user_id = auth.uid() AND ou.project_id = rc.project_id AND ou.role = 'client'
    WHERE rc.id = routine_pdf_exports.contract_id
  )
);
