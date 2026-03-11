
-- PDI Tasks (assignments within tracks)
CREATE TABLE public.pdi_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES public.pdi_tracks(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'practical',
  due_days INTEGER,
  support_material_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- PDI Books (library)
CREATE TABLE public.pdi_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT,
  summary TEXT,
  themes TEXT[],
  cover_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Link books to tracks
CREATE TABLE public.pdi_book_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES public.pdi_books(id) ON DELETE CASCADE NOT NULL,
  track_id UUID REFERENCES public.pdi_tracks(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(book_id, track_id)
);

-- Task submissions by participants
CREATE TABLE public.pdi_task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.pdi_tasks(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES public.pdi_participants(id) ON DELETE CASCADE NOT NULL,
  response_text TEXT,
  file_url TEXT,
  ai_score NUMERIC(5,2),
  ai_feedback TEXT,
  status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- Assessments (entry/exit tests)
CREATE TABLE public.pdi_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID REFERENCES public.pdi_cohorts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assessment_type TEXT NOT NULL DEFAULT 'entry',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assessment questions
CREATE TABLE public.pdi_assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.pdi_assessments(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  options JSONB,
  correct_option TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Assessment responses
CREATE TABLE public.pdi_assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.pdi_assessments(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES public.pdi_participants(id) ON DELETE CASCADE NOT NULL,
  answers JSONB DEFAULT '{}',
  total_score NUMERIC(5,2) DEFAULT 0,
  category_scores JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assessment_id, participant_id)
);

-- Certificates
CREATE TABLE public.pdi_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES public.pdi_participants(id) ON DELETE CASCADE NOT NULL,
  cohort_id UUID REFERENCES public.pdi_cohorts(id) ON DELETE CASCADE NOT NULL,
  certificate_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  total_hours NUMERIC(6,1) DEFAULT 0,
  issued_at TIMESTAMPTZ DEFAULT now(),
  pdf_url TEXT
);

-- Community posts
CREATE TABLE public.pdi_community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES public.pdi_participants(id) ON DELETE CASCADE NOT NULL,
  cohort_id UUID REFERENCES public.pdi_cohorts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  post_type TEXT DEFAULT 'discussion',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Community comments
CREATE TABLE public.pdi_community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.pdi_community_posts(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES public.pdi_participants(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE public.pdi_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_book_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdi_community_comments ENABLE ROW LEVEL SECURITY;

-- Staff full access policies
CREATE POLICY "Staff manage pdi_tasks" ON public.pdi_tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Staff manage pdi_books" ON public.pdi_books FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Staff manage pdi_book_tracks" ON public.pdi_book_tracks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Staff manage pdi_task_submissions" ON public.pdi_task_submissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Staff manage pdi_assessments" ON public.pdi_assessments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Staff manage pdi_assessment_questions" ON public.pdi_assessment_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Staff manage pdi_assessment_responses" ON public.pdi_assessment_responses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Staff manage pdi_certificates" ON public.pdi_certificates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Staff manage pdi_community_posts" ON public.pdi_community_posts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Staff manage pdi_community_comments" ON public.pdi_community_comments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

-- Public access for task submissions (participants via token)
CREATE POLICY "Anon insert pdi_task_submissions" ON public.pdi_task_submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon select pdi_task_submissions" ON public.pdi_task_submissions FOR SELECT TO anon USING (true);

-- Public read for community
CREATE POLICY "Anon read pdi_community_posts" ON public.pdi_community_posts FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert pdi_community_posts" ON public.pdi_community_posts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon read pdi_community_comments" ON public.pdi_community_comments FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert pdi_community_comments" ON public.pdi_community_comments FOR INSERT TO anon WITH CHECK (true);

-- Public read for assessments/tasks
CREATE POLICY "Anon read pdi_assessments" ON public.pdi_assessments FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read pdi_assessment_questions" ON public.pdi_assessment_questions FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert pdi_assessment_responses" ON public.pdi_assessment_responses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon select pdi_assessment_responses" ON public.pdi_assessment_responses FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read pdi_tasks" ON public.pdi_tasks FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read pdi_books" ON public.pdi_books FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read pdi_book_tracks" ON public.pdi_book_tracks FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read pdi_certificates" ON public.pdi_certificates FOR SELECT TO anon USING (true);
