-- ==============================================
-- MÓDULO RH & RECRUTAMENTO - ESTRUTURA COMPLETA
-- ==============================================

-- ========== 1. VAGAS (Job Openings) ==========
CREATE TABLE public.job_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  area TEXT NOT NULL, -- Comercial, CS, Marketing, Operações, etc.
  job_type TEXT NOT NULL, -- SDR, Closer, Consultor, CS, Outro
  description TEXT,
  requirements TEXT,
  differentials TEXT,
  seniority TEXT, -- Júnior, Pleno, Sênior, Especialista
  contract_model TEXT, -- CLT, PJ, Comissão, Híbrido
  status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, paused, closed
  salary_range TEXT,
  location TEXT,
  is_remote BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- ========== 2. CANDIDATOS (Candidates) ==========
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  job_opening_id UUID REFERENCES public.job_openings(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cpf TEXT,
  linkedin_url TEXT,
  source TEXT NOT NULL DEFAULT 'hr', -- client, hr, public_link
  current_stage TEXT NOT NULL DEFAULT 'received', -- received, screening, disc, hr_interview, technical_interview, final_interview, approved, rejected, talent_pool
  status TEXT NOT NULL DEFAULT 'active', -- active, hired, rejected, withdrawn
  notes TEXT,
  created_by_staff_id UUID REFERENCES public.onboarding_staff(id),
  created_by_user_id UUID REFERENCES public.onboarding_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 3. CURRÍCULOS (Resumes) ==========
CREATE TABLE public.candidate_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT, -- pdf, doc, docx
  file_size INTEGER,
  is_primary BOOLEAN DEFAULT true,
  uploaded_by_staff_id UUID REFERENCES public.onboarding_staff(id),
  uploaded_by_user_id UUID REFERENCES public.onboarding_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 4. ETAPAS DO PIPELINE (Pipeline Stages) ==========
CREATE TABLE public.hiring_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage_key TEXT NOT NULL, -- received, screening, disc, hr_interview, etc.
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#6366f1',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 5. ENTREVISTAS (Interviews) ==========
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_opening_id UUID REFERENCES public.job_openings(id) ON DELETE SET NULL,
  interview_type TEXT NOT NULL, -- hr, technical, final
  scheduled_at TIMESTAMPTZ,
  conducted_at TIMESTAMPTZ,
  interviewer_id UUID REFERENCES public.onboarding_staff(id),
  interviewer_name TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
  score NUMERIC(3,1), -- 0 to 10
  strengths TEXT,
  concerns TEXT,
  detailed_feedback TEXT,
  recommendation TEXT, -- approved, rejected, talent_pool
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 6. RESULTADOS DISC (DISC Results) ==========
CREATE TABLE public.candidate_disc_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed
  dominant_profile TEXT, -- D, I, S, C
  d_score INTEGER,
  i_score INTEGER,
  s_score INTEGER,
  c_score INTEGER,
  interpretation TEXT,
  raw_responses JSONB,
  completed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 7. AVALIAÇÕES DA IA (AI Evaluations) ==========
CREATE TABLE public.candidate_ai_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES public.candidate_resumes(id) ON DELETE CASCADE,
  job_opening_id UUID REFERENCES public.job_openings(id) ON DELETE SET NULL,
  compatibility_score INTEGER, -- 0 to 100
  classification TEXT, -- high_fit, medium_fit, low_fit
  strengths TEXT[],
  concerns TEXT[],
  recommendation TEXT, -- advance, evaluate_carefully, reject
  full_analysis TEXT,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 8. HISTÓRICO (Hiring History) ==========
CREATE TABLE public.hiring_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- stage_change, interview_scheduled, disc_sent, evaluation_added, note_added, etc.
  previous_value TEXT,
  new_value TEXT,
  description TEXT,
  performed_by_staff_id UUID REFERENCES public.onboarding_staff(id),
  performed_by_user_id UUID REFERENCES public.onboarding_users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== TRIGGERS PARA updated_at ==========
CREATE TRIGGER update_job_openings_updated_at
  BEFORE UPDATE ON public.job_openings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interviews_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== FUNÇÃO PARA VERIFICAR ACESSO HR ==========
CREATE OR REPLACE FUNCTION public.has_hr_edit_access(check_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role IN ('admin', 'consultant', 'cs', 'rh')
  )
  OR EXISTS (
    SELECT 1 FROM public.onboarding_companies oc
    JOIN public.onboarding_projects op ON op.onboarding_company_id = oc.id
    WHERE op.id = check_project_id
    AND (oc.consultant_id IN (SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
         OR oc.cs_id IN (SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true))
  )
$$;

CREATE OR REPLACE FUNCTION public.has_hr_view_access(check_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Staff with edit access
  SELECT public.has_hr_edit_access(check_project_id)
  OR
  -- Client users can view
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.project_id = check_project_id
  )
$$;

-- ========== RLS POLICIES ==========

-- Job Openings
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view job openings" ON public.job_openings
  FOR SELECT USING (public.has_hr_view_access(project_id));

CREATE POLICY "Staff can insert job openings" ON public.job_openings
  FOR INSERT WITH CHECK (public.has_hr_edit_access(project_id));

CREATE POLICY "Staff can update job openings" ON public.job_openings
  FOR UPDATE USING (public.has_hr_edit_access(project_id));

CREATE POLICY "Staff can delete job openings" ON public.job_openings
  FOR DELETE USING (public.has_hr_edit_access(project_id));

-- Candidates
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view candidates" ON public.candidates
  FOR SELECT USING (public.has_hr_view_access(project_id));

CREATE POLICY "Staff can insert candidates" ON public.candidates
  FOR INSERT WITH CHECK (
    public.has_hr_edit_access(project_id)
    OR EXISTS (
      SELECT 1 FROM public.onboarding_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.project_id = candidates.project_id
    )
  );

CREATE POLICY "Staff can update candidates" ON public.candidates
  FOR UPDATE USING (public.has_hr_edit_access(project_id));

CREATE POLICY "Staff can delete candidates" ON public.candidates
  FOR DELETE USING (public.has_hr_edit_access(project_id));

-- Resumes
ALTER TABLE public.candidate_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view resumes" ON public.candidate_resumes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_resumes.candidate_id
      AND public.has_hr_view_access(c.project_id)
    )
  );

CREATE POLICY "Users can insert resumes" ON public.candidate_resumes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_resumes.candidate_id
      AND (
        public.has_hr_edit_access(c.project_id)
        OR EXISTS (
          SELECT 1 FROM public.onboarding_users ou
          WHERE ou.user_id = auth.uid()
          AND ou.project_id = c.project_id
        )
      )
    )
  );

CREATE POLICY "Staff can update resumes" ON public.candidate_resumes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_resumes.candidate_id
      AND public.has_hr_edit_access(c.project_id)
    )
  );

CREATE POLICY "Staff can delete resumes" ON public.candidate_resumes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_resumes.candidate_id
      AND public.has_hr_edit_access(c.project_id)
    )
  );

-- Pipeline Stages
ALTER TABLE public.hiring_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pipeline stages" ON public.hiring_pipeline_stages
  FOR SELECT USING (public.has_hr_view_access(project_id));

CREATE POLICY "Staff can manage pipeline stages" ON public.hiring_pipeline_stages
  FOR ALL USING (public.has_hr_edit_access(project_id));

-- Interviews
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view interviews" ON public.interviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = interviews.candidate_id
      AND public.has_hr_view_access(c.project_id)
    )
  );

CREATE POLICY "Staff can manage interviews" ON public.interviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = interviews.candidate_id
      AND public.has_hr_edit_access(c.project_id)
    )
  );

-- DISC Results
ALTER TABLE public.candidate_disc_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view disc results" ON public.candidate_disc_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_disc_results.candidate_id
      AND public.has_hr_view_access(c.project_id)
    )
  );

CREATE POLICY "Staff can manage disc results" ON public.candidate_disc_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_disc_results.candidate_id
      AND public.has_hr_edit_access(c.project_id)
    )
  );

-- Public access for candidates taking DISC via token
CREATE POLICY "Candidates can update their own disc via token" ON public.candidate_disc_results
  FOR UPDATE USING (true)
  WITH CHECK (status = 'pending');

CREATE POLICY "Candidates can view their disc via token" ON public.candidate_disc_results
  FOR SELECT USING (true);

-- AI Evaluations
ALTER TABLE public.candidate_ai_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ai evaluations" ON public.candidate_ai_evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_ai_evaluations.candidate_id
      AND public.has_hr_view_access(c.project_id)
    )
  );

CREATE POLICY "Staff can manage ai evaluations" ON public.candidate_ai_evaluations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_ai_evaluations.candidate_id
      AND public.has_hr_edit_access(c.project_id)
    )
  );

-- Hiring History
ALTER TABLE public.hiring_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view hiring history" ON public.hiring_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = hiring_history.candidate_id
      AND public.has_hr_view_access(c.project_id)
    )
  );

CREATE POLICY "Staff can insert hiring history" ON public.hiring_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = hiring_history.candidate_id
      AND public.has_hr_edit_access(c.project_id)
    )
  );

-- ========== TRIGGER PARA HISTÓRICO AUTOMÁTICO ==========
CREATE OR REPLACE FUNCTION public.log_candidate_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  IF OLD.current_stage IS DISTINCT FROM NEW.current_stage THEN
    SELECT id INTO v_staff_id
    FROM public.onboarding_staff
    WHERE user_id = auth.uid() AND is_active = true
    LIMIT 1;

    INSERT INTO public.hiring_history (
      candidate_id, action, previous_value, new_value, description, performed_by_staff_id
    ) VALUES (
      NEW.id,
      'stage_change',
      OLD.current_stage,
      NEW.current_stage,
      'Candidato movido de ' || COALESCE(OLD.current_stage, 'início') || ' para ' || NEW.current_stage,
      v_staff_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_candidate_stage_change_trigger
  AFTER UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.log_candidate_stage_change();

-- ========== STORAGE BUCKET PARA CURRÍCULOS ==========
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('resumes', 'resumes', false, 10485760) -- 10MB limit
ON CONFLICT (id) DO NOTHING;

-- Storage policies for resumes bucket
CREATE POLICY "Staff can upload resumes" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can view resumes" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'resumes'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Staff can delete resumes" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'resumes'
    AND auth.uid() IS NOT NULL
  );

-- ========== ÍNDICES ==========
CREATE INDEX idx_job_openings_project_id ON public.job_openings(project_id);
CREATE INDEX idx_job_openings_status ON public.job_openings(status);
CREATE INDEX idx_candidates_project_id ON public.candidates(project_id);
CREATE INDEX idx_candidates_job_opening_id ON public.candidates(job_opening_id);
CREATE INDEX idx_candidates_current_stage ON public.candidates(current_stage);
CREATE INDEX idx_interviews_candidate_id ON public.interviews(candidate_id);
CREATE INDEX idx_candidate_disc_results_candidate_id ON public.candidate_disc_results(candidate_id);
CREATE INDEX idx_candidate_disc_results_token ON public.candidate_disc_results(access_token);
CREATE INDEX idx_hiring_history_candidate_id ON public.hiring_history(candidate_id);