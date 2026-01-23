
-- =====================================================
-- UNV ACADEMY - Complete Database Schema
-- =====================================================

-- 1. TRACKS (Trilhas)
CREATE TABLE public.academy_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'geral', -- gestao, vendas, rh, etc
  cover_image_url TEXT,
  level INTEGER NOT NULL DEFAULT 1, -- 1, 2, 3...
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  require_sequential_lessons BOOLEAN NOT NULL DEFAULT true,
  require_quiz_to_advance BOOLEAN NOT NULL DEFAULT true,
  min_quiz_score INTEGER NOT NULL DEFAULT 70, -- percentage
  prerequisite_track_id UUID REFERENCES public.academy_tracks(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. MODULES (Módulos dentro de Trilhas)
CREATE TABLE public.academy_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.academy_tracks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. LESSONS (Aulas)
CREATE TABLE public.academy_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.academy_tracks(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.academy_modules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  video_provider TEXT NOT NULL DEFAULT 'youtube', -- youtube, vimeo, panda, embed
  transcript TEXT, -- for AI quiz generation
  estimated_duration_minutes INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  points_on_complete INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. LESSON ASSETS (Materiais complementares)
CREATE TABLE public.academy_lesson_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'pdf', -- pdf, link, file
  asset_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. QUIZZES (Provas)
CREATE TABLE public.academy_quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID REFERENCES public.academy_tracks(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.academy_modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  quiz_type TEXT NOT NULL DEFAULT 'track_final', -- lesson, module, track_final
  min_score INTEGER NOT NULL DEFAULT 70,
  max_attempts INTEGER DEFAULT 3,
  time_limit_minutes INTEGER,
  randomize_questions BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  points_on_pass INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT quiz_has_parent CHECK (
    track_id IS NOT NULL OR module_id IS NOT NULL OR lesson_id IS NOT NULL
  )
);

-- 6. QUIZ QUESTIONS (Questões)
CREATE TABLE public.academy_quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.academy_quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice', -- multiple_choice, true_false, short_answer
  options JSONB, -- for multiple choice: [{text, isCorrect}]
  correct_answer TEXT, -- for true_false or short_answer
  explanation TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium', -- easy, medium, hard
  points INTEGER NOT NULL DEFAULT 10,
  tags TEXT[],
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  is_approved BOOLEAN NOT NULL DEFAULT false, -- admin must approve AI questions
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. USER ACCESS (Liberação de acesso)
CREATE TABLE public.academy_user_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Can be linked to onboarding_users OR a separate academy user
  onboarding_user_id UUID REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  -- What they have access to
  track_id UUID REFERENCES public.academy_tracks(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.academy_modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  -- Access type
  access_level TEXT NOT NULL DEFAULT 'view', -- view, full
  granted_by UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT access_has_target CHECK (
    track_id IS NOT NULL OR module_id IS NOT NULL OR lesson_id IS NOT NULL OR company_id IS NOT NULL
  )
);

-- 8. USER PROGRESS (Progresso do usuário)
CREATE TABLE public.academy_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started, in_progress, completed
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_position_seconds INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(onboarding_user_id, lesson_id)
);

-- 9. QUIZ ATTEMPTS (Tentativas de prova)
CREATE TABLE public.academy_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.academy_quizzes(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '[]', -- [{questionId, answer, isCorrect, points}]
  score INTEGER NOT NULL DEFAULT 0, -- percentage
  total_points INTEGER NOT NULL DEFAULT 0,
  max_points INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  time_taken_seconds INTEGER,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. CERTIFICATES (Certificados)
CREATE TABLE public.academy_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.academy_tracks(id) ON DELETE CASCADE,
  certificate_code TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  quiz_score INTEGER,
  total_hours INTEGER,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 11. GAMIFICATION CONFIG (Configuração por empresa/global)
CREATE TABLE public.academy_gamification_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  -- If company_id is null, it's global config
  points_per_lesson INTEGER NOT NULL DEFAULT 10,
  points_per_module INTEGER NOT NULL DEFAULT 30,
  points_per_track INTEGER NOT NULL DEFAULT 100,
  points_per_quiz_pass INTEGER NOT NULL DEFAULT 50,
  points_bonus_perfect_score INTEGER NOT NULL DEFAULT 25,
  points_streak_7_days INTEGER NOT NULL DEFAULT 50,
  enable_ranking BOOLEAN NOT NULL DEFAULT true,
  enable_badges BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 12. POINTS LEDGER (Histórico de pontos)
CREATE TABLE public.academy_points_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  action_type TEXT NOT NULL, -- lesson_complete, quiz_pass, badge_earned, streak, etc
  description TEXT,
  reference_id UUID, -- lesson_id, quiz_id, badge_id, etc
  reference_type TEXT, -- lesson, quiz, badge, etc
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 13. BADGES (Conquistas)
CREATE TABLE public.academy_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'award', -- lucide icon name
  color TEXT NOT NULL DEFAULT '#FFD700',
  criteria_type TEXT NOT NULL, -- first_lesson, first_quiz, track_complete, streak_7, top_3, custom
  criteria_value INTEGER, -- e.g., 7 for streak_7
  points_reward INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 14. USER BADGES (Badges conquistados)
CREATE TABLE public.academy_user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.academy_badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reference_id UUID,
  reference_type TEXT,
  UNIQUE(onboarding_user_id, badge_id)
);

-- 15. USER LEVELS (Níveis calculados)
CREATE TABLE public.academy_user_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_user_id UUID NOT NULL REFERENCES public.onboarding_users(id) ON DELETE CASCADE UNIQUE,
  total_points INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  level_name TEXT NOT NULL DEFAULT 'Iniciante',
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  quizzes_passed INTEGER NOT NULL DEFAULT 0,
  tracks_completed INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 16. LEVEL DEFINITIONS
CREATE TABLE public.academy_level_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default levels
INSERT INTO public.academy_level_definitions (level, name, min_points, icon, color) VALUES
(1, 'Iniciante', 0, 'Sprout', '#94a3b8'),
(2, 'Aprendiz', 100, 'BookOpen', '#22c55e'),
(3, 'Intermediário', 300, 'GraduationCap', '#3b82f6'),
(4, 'Avançado', 600, 'Trophy', '#a855f7'),
(5, 'Expert', 1000, 'Crown', '#f59e0b'),
(6, 'Elite', 2000, 'Star', '#ef4444');

-- Insert default badges
INSERT INTO public.academy_badges (name, description, icon, color, criteria_type, criteria_value, points_reward, sort_order) VALUES
('Primeira Aula', 'Completou sua primeira aula', 'Play', '#22c55e', 'first_lesson', 1, 10, 1),
('Primeira Prova', 'Passou na primeira prova', 'CheckCircle', '#3b82f6', 'first_quiz', 1, 20, 2),
('Trilha Completa', 'Concluiu uma trilha inteira', 'Flag', '#a855f7', 'track_complete', 1, 50, 3),
('Estudante Dedicado', '7 dias consecutivos de estudo', 'Flame', '#f59e0b', 'streak_7', 7, 30, 4),
('Nota Máxima', 'Tirou 100% em uma prova', 'Zap', '#ef4444', 'perfect_score', 100, 25, 5),
('Top 3', 'Ficou entre os 3 primeiros do ranking', 'Medal', '#ffd700', 'top_3', 3, 40, 6);

-- Insert default gamification config (global)
INSERT INTO public.academy_gamification_config (points_per_lesson, points_per_module, points_per_track, points_per_quiz_pass, points_bonus_perfect_score, points_streak_7_days) VALUES
(10, 30, 100, 50, 25, 50);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_academy_tracks_category ON public.academy_tracks(category);
CREATE INDEX idx_academy_tracks_level ON public.academy_tracks(level);
CREATE INDEX idx_academy_modules_track ON public.academy_modules(track_id);
CREATE INDEX idx_academy_lessons_track ON public.academy_lessons(track_id);
CREATE INDEX idx_academy_lessons_module ON public.academy_lessons(module_id);
CREATE INDEX idx_academy_progress_user ON public.academy_progress(onboarding_user_id);
CREATE INDEX idx_academy_progress_lesson ON public.academy_progress(lesson_id);
CREATE INDEX idx_academy_quiz_attempts_user ON public.academy_quiz_attempts(onboarding_user_id);
CREATE INDEX idx_academy_quiz_attempts_quiz ON public.academy_quiz_attempts(quiz_id);
CREATE INDEX idx_academy_points_ledger_user ON public.academy_points_ledger(onboarding_user_id);
CREATE INDEX idx_academy_user_badges_user ON public.academy_user_badges(onboarding_user_id);
CREATE INDEX idx_academy_user_access_user ON public.academy_user_access(onboarding_user_id);
CREATE INDEX idx_academy_user_access_company ON public.academy_user_access(company_id);

-- =====================================================
-- ENABLE RLS
-- =====================================================
ALTER TABLE public.academy_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lesson_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_gamification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_level_definitions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Tracks: Staff can manage, users can view active
CREATE POLICY "Staff can manage tracks" ON public.academy_tracks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'cs', 'consultant'))
  );

CREATE POLICY "Users can view active tracks" ON public.academy_tracks
  FOR SELECT USING (is_active = true);

-- Modules: Similar to tracks
CREATE POLICY "Staff can manage modules" ON public.academy_modules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'cs', 'consultant'))
  );

CREATE POLICY "Users can view active modules" ON public.academy_modules
  FOR SELECT USING (is_active = true);

-- Lessons: Similar
CREATE POLICY "Staff can manage lessons" ON public.academy_lessons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'cs', 'consultant'))
  );

CREATE POLICY "Users can view active lessons" ON public.academy_lessons
  FOR SELECT USING (is_active = true);

-- Lesson Assets
CREATE POLICY "Staff can manage lesson assets" ON public.academy_lesson_assets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'cs', 'consultant'))
  );

CREATE POLICY "Users can view lesson assets" ON public.academy_lesson_assets
  FOR SELECT USING (true);

-- Quizzes
CREATE POLICY "Staff can manage quizzes" ON public.academy_quizzes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'cs', 'consultant'))
  );

CREATE POLICY "Users can view active quizzes" ON public.academy_quizzes
  FOR SELECT USING (is_active = true);

-- Quiz Questions
CREATE POLICY "Staff can manage quiz questions" ON public.academy_quiz_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'cs', 'consultant'))
  );

CREATE POLICY "Users can view approved questions" ON public.academy_quiz_questions
  FOR SELECT USING (is_approved = true OR is_ai_generated = false);

-- User Access
CREATE POLICY "Staff can manage user access" ON public.academy_user_access
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'cs', 'consultant'))
  );

CREATE POLICY "Users can view own access" ON public.academy_user_access
  FOR SELECT USING (
    onboarding_user_id IN (SELECT id FROM public.onboarding_users WHERE user_id = auth.uid())
    OR company_id IN (
      SELECT op.onboarding_company_id FROM public.onboarding_users ou
      JOIN public.onboarding_projects op ON op.id = ou.project_id
      WHERE ou.user_id = auth.uid() AND ou.role = 'client'
    )
  );

-- Progress
CREATE POLICY "Staff can view all progress" ON public.academy_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Users can manage own progress" ON public.academy_progress
  FOR ALL USING (
    onboarding_user_id IN (SELECT id FROM public.onboarding_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Client managers can view company progress" ON public.academy_progress
  FOR SELECT USING (
    onboarding_user_id IN (
      SELECT ou.id FROM public.onboarding_users ou
      JOIN public.onboarding_projects op ON op.id = ou.project_id
      WHERE op.onboarding_company_id IN (
        SELECT op2.onboarding_company_id FROM public.onboarding_users ou2
        JOIN public.onboarding_projects op2 ON op2.id = ou2.project_id
        WHERE ou2.user_id = auth.uid() AND ou2.role = 'client'
      )
    )
  );

-- Quiz Attempts
CREATE POLICY "Staff can view all attempts" ON public.academy_quiz_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Users can manage own attempts" ON public.academy_quiz_attempts
  FOR ALL USING (
    onboarding_user_id IN (SELECT id FROM public.onboarding_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Client managers can view company attempts" ON public.academy_quiz_attempts
  FOR SELECT USING (
    onboarding_user_id IN (
      SELECT ou.id FROM public.onboarding_users ou
      JOIN public.onboarding_projects op ON op.id = ou.project_id
      WHERE op.onboarding_company_id IN (
        SELECT op2.onboarding_company_id FROM public.onboarding_users ou2
        JOIN public.onboarding_projects op2 ON op2.id = ou2.project_id
        WHERE ou2.user_id = auth.uid() AND ou2.role = 'client'
      )
    )
  );

-- Certificates
CREATE POLICY "Staff can manage certificates" ON public.academy_certificates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'cs'))
  );

CREATE POLICY "Users can view own certificates" ON public.academy_certificates
  FOR SELECT USING (
    onboarding_user_id IN (SELECT id FROM public.onboarding_users WHERE user_id = auth.uid())
  );

-- Gamification Config
CREATE POLICY "Staff can manage gamification config" ON public.academy_gamification_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role = 'admin')
  );

CREATE POLICY "All can view gamification config" ON public.academy_gamification_config
  FOR SELECT USING (true);

-- Points Ledger
CREATE POLICY "Staff can view all points" ON public.academy_points_ledger
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Users can view own points" ON public.academy_points_ledger
  FOR SELECT USING (
    onboarding_user_id IN (SELECT id FROM public.onboarding_users WHERE user_id = auth.uid())
  );

CREATE POLICY "System can insert points" ON public.academy_points_ledger
  FOR INSERT WITH CHECK (true);

-- Badges
CREATE POLICY "Staff can manage badges" ON public.academy_badges
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role = 'admin')
  );

CREATE POLICY "All can view active badges" ON public.academy_badges
  FOR SELECT USING (is_active = true);

-- User Badges
CREATE POLICY "Staff can view all user badges" ON public.academy_user_badges
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Users can view own badges" ON public.academy_user_badges
  FOR SELECT USING (
    onboarding_user_id IN (SELECT id FROM public.onboarding_users WHERE user_id = auth.uid())
  );

CREATE POLICY "System can insert user badges" ON public.academy_user_badges
  FOR INSERT WITH CHECK (true);

-- User Levels
CREATE POLICY "Staff can view all levels" ON public.academy_user_levels
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Users can view own level" ON public.academy_user_levels
  FOR SELECT USING (
    onboarding_user_id IN (SELECT id FROM public.onboarding_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view company levels for ranking" ON public.academy_user_levels
  FOR SELECT USING (
    onboarding_user_id IN (
      SELECT ou.id FROM public.onboarding_users ou
      JOIN public.onboarding_projects op ON op.id = ou.project_id
      WHERE op.onboarding_company_id IN (
        SELECT op2.onboarding_company_id FROM public.onboarding_users ou2
        JOIN public.onboarding_projects op2 ON op2.id = ou2.project_id
        WHERE ou2.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can upsert user levels" ON public.academy_user_levels
  FOR ALL USING (true);

-- Level Definitions
CREATE POLICY "All can view level definitions" ON public.academy_level_definitions
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage level definitions" ON public.academy_level_definitions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role = 'admin')
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamps
CREATE TRIGGER update_academy_tracks_updated_at
  BEFORE UPDATE ON public.academy_tracks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_academy_modules_updated_at
  BEFORE UPDATE ON public.academy_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_academy_lessons_updated_at
  BEFORE UPDATE ON public.academy_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_academy_quizzes_updated_at
  BEFORE UPDATE ON public.academy_quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_academy_progress_updated_at
  BEFORE UPDATE ON public.academy_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_academy_gamification_config_updated_at
  BEFORE UPDATE ON public.academy_gamification_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_academy_user_levels_updated_at
  BEFORE UPDATE ON public.academy_user_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update user level when points change
CREATE OR REPLACE FUNCTION public.update_academy_user_level()
RETURNS TRIGGER AS $$
DECLARE
  v_total_points INTEGER;
  v_level_info RECORD;
BEGIN
  -- Calculate total points
  SELECT COALESCE(SUM(points), 0) INTO v_total_points
  FROM public.academy_points_ledger
  WHERE onboarding_user_id = NEW.onboarding_user_id;

  -- Get appropriate level
  SELECT level, name INTO v_level_info
  FROM public.academy_level_definitions
  WHERE min_points <= v_total_points
  ORDER BY min_points DESC
  LIMIT 1;

  -- Upsert user level
  INSERT INTO public.academy_user_levels (onboarding_user_id, total_points, current_level, level_name, last_activity_at)
  VALUES (NEW.onboarding_user_id, v_total_points, COALESCE(v_level_info.level, 1), COALESCE(v_level_info.name, 'Iniciante'), now())
  ON CONFLICT (onboarding_user_id) DO UPDATE SET
    total_points = EXCLUDED.total_points,
    current_level = EXCLUDED.current_level,
    level_name = EXCLUDED.level_name,
    last_activity_at = EXCLUDED.last_activity_at,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_academy_user_level
  AFTER INSERT ON public.academy_points_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_academy_user_level();

-- Function to update lesson stats when progress changes
CREATE OR REPLACE FUNCTION public.update_academy_lesson_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Update user level stats
    UPDATE public.academy_user_levels
    SET lessons_completed = lessons_completed + 1, last_activity_at = now()
    WHERE onboarding_user_id = NEW.onboarding_user_id;
    
    -- If no row was updated, create one
    IF NOT FOUND THEN
      INSERT INTO public.academy_user_levels (onboarding_user_id, lessons_completed, last_activity_at)
      VALUES (NEW.onboarding_user_id, 1, now())
      ON CONFLICT (onboarding_user_id) DO UPDATE SET
        lessons_completed = public.academy_user_levels.lessons_completed + 1,
        last_activity_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_academy_lesson_stats
  AFTER INSERT OR UPDATE ON public.academy_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_academy_lesson_stats();
