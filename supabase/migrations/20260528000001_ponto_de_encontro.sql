-- ═══════════════════════════════════════════════════════════════════════════
-- PONTO DE ENCONTRO — Schema completo
-- Treinamentos coletivos em vídeo para vendedores de empresas clientes
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Adicionar "aluno" ao constraint de role do onboarding_staff ─────────
ALTER TABLE public.onboarding_staff DROP CONSTRAINT IF EXISTS onboarding_staff_role_check;
ALTER TABLE public.onboarding_staff ADD CONSTRAINT onboarding_staff_role_check
  CHECK (role IN ('master','admin','cs','consultant','closer','sdr','rh','marketing','financeiro','juridico','pending','aluno'));

-- ── 2. Trilhas ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pe_tracks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','hidden')),
  cover_url     TEXT,
  created_by    UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Aulas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pe_lessons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  video_url       TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  lesson_date     DATE,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','hidden')),
  video_state     TEXT NOT NULL DEFAULT 'recorded' CHECK (video_state IN ('live','recorded')),
  track_id        UUID REFERENCES public.pe_tracks(id) ON DELETE SET NULL,
  position        INTEGER NOT NULL DEFAULT 0,  -- order within track (0 = standalone)
  created_by      UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Acesso por empresa ──────────────────────────────────────────────────
-- Trilha liberada para empresa
CREATE TABLE IF NOT EXISTS public.pe_track_companies (
  track_id    UUID NOT NULL REFERENCES public.pe_tracks(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, company_id)
);

-- Aula avulsa liberada para empresa
CREATE TABLE IF NOT EXISTS public.pe_lesson_companies (
  lesson_id   UUID NOT NULL REFERENCES public.pe_lessons(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_id, company_id)
);

-- ── 5. Alunos (staff com role aluno + empresa vinculada) ───────────────────
-- O aluno já existe em onboarding_staff (role = 'aluno')
-- Precisa saber a qual empresa pertence → tabela de vinculação
CREATE TABLE IF NOT EXISTS public.pe_student_companies (
  staff_id    UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, company_id)
);

-- ── 6. Progresso do aluno por aula ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pe_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  lesson_id       UUID NOT NULL REFERENCES public.pe_lessons(id) ON DELETE CASCADE,
  percent_watched INTEGER NOT NULL DEFAULT 0 CHECK (percent_watched >= 0 AND percent_watched <= 100),
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  last_watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, lesson_id)
);

-- ── 7. Certificados ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pe_certificates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  lesson_id   UUID REFERENCES public.pe_lessons(id) ON DELETE CASCADE,
  track_id    UUID REFERENCES public.pe_tracks(id) ON DELETE CASCADE,
  cert_type   TEXT NOT NULL CHECK (cert_type IN ('lesson','track')),
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  code        TEXT NOT NULL UNIQUE DEFAULT UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 12))
);

-- ── 8. Enquetes (polls) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pe_polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   UUID NOT NULL REFERENCES public.pe_lessons(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  options     JSONB NOT NULL DEFAULT '[]',  -- array of strings
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pe_poll_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      UUID NOT NULL REFERENCES public.pe_polls(id) ON DELETE CASCADE,
  staff_id     UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, staff_id)
);

-- ── 9. Quizzes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pe_quizzes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   UUID NOT NULL REFERENCES public.pe_lessons(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Quiz',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- questions: [{question, options:[str], correct_index}]
CREATE TABLE IF NOT EXISTS public.pe_quiz_questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      UUID NOT NULL REFERENCES public.pe_quizzes(id) ON DELETE CASCADE,
  question     TEXT NOT NULL,
  options      JSONB NOT NULL DEFAULT '[]',
  correct_index INTEGER NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.pe_quiz_responses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     UUID NOT NULL REFERENCES public.pe_quizzes(id) ON DELETE CASCADE,
  staff_id    UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  answers     JSONB NOT NULL DEFAULT '[]',  -- array of chosen indices
  score       INTEGER NOT NULL DEFAULT 0,   -- number of correct answers
  total       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, staff_id)
);

-- ── 10. Sistema de pontos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pe_points_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL UNIQUE,  -- 'lesson_complete','track_complete','poll_response','quiz_correct','quiz_complete'
  points      INTEGER NOT NULL DEFAULT 10,
  label       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default config
INSERT INTO public.pe_points_config (event_type, points, label) VALUES
  ('lesson_complete',   50,  'Aula concluída'),
  ('track_complete',   200,  'Trilha concluída'),
  ('poll_response',     10,  'Respondeu enquete'),
  ('quiz_complete',     20,  'Completou quiz'),
  ('quiz_correct',      15,  'Resposta correta no quiz')
ON CONFLICT (event_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.pe_points_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  reference_id UUID,           -- lesson_id, track_id, poll_id, quiz_id
  points       INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 11. Índices ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS pe_lessons_track_id_idx ON public.pe_lessons(track_id);
CREATE INDEX IF NOT EXISTS pe_progress_staff_id_idx ON public.pe_progress(staff_id);
CREATE INDEX IF NOT EXISTS pe_progress_lesson_id_idx ON public.pe_progress(lesson_id);
CREATE INDEX IF NOT EXISTS pe_points_log_staff_id_idx ON public.pe_points_log(staff_id);
CREATE INDEX IF NOT EXISTS pe_certificates_staff_id_idx ON public.pe_certificates(staff_id);

-- ── 12. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.pe_tracks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_lessons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_track_companies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_lesson_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_student_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_progress         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_certificates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_polls            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_poll_responses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_quizzes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_quiz_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_quiz_responses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_points_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pe_points_log       ENABLE ROW LEVEL SECURITY;

-- Helper: is instructor or above (consultant, cs, admin, master)
CREATE OR REPLACE FUNCTION public.pe_is_instructor()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid()
      AND s.is_active = TRUE
      AND s.role IN ('consultant','cs','admin','master')
  );
$$;

-- Helper: current staff id
CREATE OR REPLACE FUNCTION public.pe_current_staff_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = TRUE LIMIT 1;
$$;

-- Tracks: instructors full access, students can read active tracks for their company
CREATE POLICY "pe_tracks_instructor_all" ON public.pe_tracks
  FOR ALL USING (public.pe_is_instructor());

CREATE POLICY "pe_tracks_student_read" ON public.pe_tracks
  FOR SELECT USING (
    status = 'active' AND
    EXISTS (
      SELECT 1 FROM public.pe_track_companies tc
      JOIN public.pe_student_companies sc ON sc.company_id = tc.company_id
      WHERE tc.track_id = pe_tracks.id AND sc.staff_id = public.pe_current_staff_id()
    )
  );

-- Lessons: instructors full, students read active
CREATE POLICY "pe_lessons_instructor_all" ON public.pe_lessons
  FOR ALL USING (public.pe_is_instructor());

CREATE POLICY "pe_lessons_student_read" ON public.pe_lessons
  FOR SELECT USING (
    status = 'active' AND (
      -- in a track the student has access to
      (track_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.pe_track_companies tc
        JOIN public.pe_student_companies sc ON sc.company_id = tc.company_id
        JOIN public.pe_tracks t ON t.id = tc.track_id
        WHERE tc.track_id = pe_lessons.track_id
          AND sc.staff_id = public.pe_current_staff_id()
          AND t.status = 'active'
      ))
      OR
      -- standalone lesson for student's company
      (track_id IS NULL AND EXISTS (
        SELECT 1 FROM public.pe_lesson_companies lc
        JOIN public.pe_student_companies sc ON sc.company_id = lc.company_id
        WHERE lc.lesson_id = pe_lessons.id AND sc.staff_id = public.pe_current_staff_id()
      ))
    )
  );

-- Company access tables: instructors full
CREATE POLICY "pe_track_companies_instructor" ON public.pe_track_companies FOR ALL USING (public.pe_is_instructor());
CREATE POLICY "pe_lesson_companies_instructor" ON public.pe_lesson_companies FOR ALL USING (public.pe_is_instructor());
CREATE POLICY "pe_student_companies_instructor" ON public.pe_student_companies FOR ALL USING (public.pe_is_instructor());
CREATE POLICY "pe_student_companies_self" ON public.pe_student_companies FOR SELECT USING (staff_id = public.pe_current_staff_id());

-- Progress: student owns their own, instructors see all
CREATE POLICY "pe_progress_own" ON public.pe_progress FOR ALL USING (staff_id = public.pe_current_staff_id());
CREATE POLICY "pe_progress_instructor" ON public.pe_progress FOR SELECT USING (public.pe_is_instructor());

-- Certificates: own or instructor
CREATE POLICY "pe_certificates_own" ON public.pe_certificates FOR SELECT USING (staff_id = public.pe_current_staff_id());
CREATE POLICY "pe_certificates_instructor" ON public.pe_certificates FOR ALL USING (public.pe_is_instructor());
CREATE POLICY "pe_certificates_insert_own" ON public.pe_certificates FOR INSERT WITH CHECK (staff_id = public.pe_current_staff_id());

-- Polls/Quizzes: instructors manage, students read active
CREATE POLICY "pe_polls_instructor" ON public.pe_polls FOR ALL USING (public.pe_is_instructor());
CREATE POLICY "pe_polls_student_read" ON public.pe_polls FOR SELECT USING (is_active = TRUE);
CREATE POLICY "pe_poll_responses_own" ON public.pe_poll_responses FOR ALL USING (staff_id = public.pe_current_staff_id());
CREATE POLICY "pe_poll_responses_instructor" ON public.pe_poll_responses FOR SELECT USING (public.pe_is_instructor());

CREATE POLICY "pe_quizzes_instructor" ON public.pe_quizzes FOR ALL USING (public.pe_is_instructor());
CREATE POLICY "pe_quizzes_student_read" ON public.pe_quizzes FOR SELECT USING (is_active = TRUE);
CREATE POLICY "pe_quiz_questions_instructor" ON public.pe_quiz_questions FOR ALL USING (public.pe_is_instructor());
CREATE POLICY "pe_quiz_questions_student_read" ON public.pe_quiz_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.pe_quizzes q WHERE q.id = pe_quiz_questions.quiz_id AND q.is_active = TRUE)
);
CREATE POLICY "pe_quiz_responses_own" ON public.pe_quiz_responses FOR ALL USING (staff_id = public.pe_current_staff_id());
CREATE POLICY "pe_quiz_responses_instructor" ON public.pe_quiz_responses FOR SELECT USING (public.pe_is_instructor());

-- Points config: readable by all authenticated, managed by instructor
CREATE POLICY "pe_points_config_read" ON public.pe_points_config FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "pe_points_config_instructor" ON public.pe_points_config FOR ALL USING (public.pe_is_instructor());

-- Points log: own or instructor
CREATE POLICY "pe_points_log_own" ON public.pe_points_log FOR SELECT USING (staff_id = public.pe_current_staff_id());
CREATE POLICY "pe_points_log_insert_own" ON public.pe_points_log FOR INSERT WITH CHECK (staff_id = public.pe_current_staff_id());
CREATE POLICY "pe_points_log_instructor" ON public.pe_points_log FOR SELECT USING (public.pe_is_instructor());
