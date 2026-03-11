
-- PDI Module - Core Tables

CREATE TABLE public.pdi_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdi_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage programs" ON public.pdi_programs FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE TABLE public.pdi_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.pdi_programs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  total_hours INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdi_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage tracks" ON public.pdi_tracks FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE TABLE public.pdi_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.pdi_programs(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  start_date DATE,
  end_date DATE,
  min_participants INTEGER DEFAULT 1,
  max_participants INTEGER DEFAULT 50,
  total_hours INTEGER DEFAULT 0,
  responsible_staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  enrollment_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_enrollment_open BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdi_cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage cohorts" ON public.pdi_cohorts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE TABLE public.pdi_cohort_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.pdi_cohorts(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.pdi_tracks(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cohort_id, track_id)
);

ALTER TABLE public.pdi_cohort_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage cohort tracks" ON public.pdi_cohort_tracks FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));

CREATE TABLE public.pdi_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.pdi_cohorts(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role_title TEXT,
  company TEXT,
  experience_years INTEGER,
  professional_goal TEXT,
  current_challenges TEXT,
  motivation TEXT,
  leadership_level TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdi_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage applications" ON public.pdi_applications FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Anyone can apply" ON public.pdi_applications FOR INSERT TO anon WITH CHECK (true);

CREATE TABLE public.pdi_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.pdi_cohorts(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.pdi_applications(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role_title TEXT,
  company TEXT,
  access_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdi_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage participants" ON public.pdi_participants FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "Participants can view own data" ON public.pdi_participants FOR SELECT TO anon USING (true);
