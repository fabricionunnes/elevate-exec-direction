-- Drop any existing tables and types first
DROP TABLE IF EXISTS public.meeting_presentation_logs CASCADE;
DROP TABLE IF EXISTS public.meeting_presentation_slides CASCADE;
DROP TABLE IF EXISTS public.meeting_presentation_versions CASCADE;
DROP TABLE IF EXISTS public.meeting_presentations CASCADE;
DROP TYPE IF EXISTS public.presentation_status CASCADE;
DROP TYPE IF EXISTS public.meeting_objective CASCADE;
DROP TYPE IF EXISTS public.meeting_audience CASCADE;
DROP TYPE IF EXISTS public.meeting_depth_level CASCADE;
DROP TYPE IF EXISTS public.presentation_tone CASCADE;

-- Create enums
CREATE TYPE public.presentation_status AS ENUM ('draft', 'approved', 'archived');
CREATE TYPE public.meeting_objective AS ENUM ('diagnostico', 'alinhamento', 'planejamento', 'resultados', 'decisao');
CREATE TYPE public.meeting_audience AS ENUM ('empresario', 'diretoria', 'gestores', 'time_operacional');
CREATE TYPE public.meeting_depth_level AS ENUM ('estrategico', 'tatico', 'operacional');
CREATE TYPE public.presentation_tone AS ENUM ('institucional', 'consultivo', 'provocativo', 'inspirador');

-- Main presentations table
CREATE TABLE public.meeting_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.onboarding_meeting_notes(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  central_theme TEXT NOT NULL,
  objective public.meeting_objective DEFAULT 'alinhamento',
  audience public.meeting_audience DEFAULT 'empresario',
  depth_level public.meeting_depth_level DEFAULT 'estrategico',
  estimated_duration_minutes INTEGER DEFAULT 60,
  key_metrics TEXT,
  must_include_points TEXT,
  tone public.presentation_tone DEFAULT 'consultivo',
  created_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Presentation versions table
CREATE TABLE public.meeting_presentation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.meeting_presentations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  status public.presentation_status DEFAULT 'draft',
  title TEXT,
  company_name TEXT,
  meeting_date DATE,
  pdf_url TEXT,
  generated_by UUID REFERENCES public.onboarding_staff(id),
  approved_by UUID REFERENCES public.onboarding_staff(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(presentation_id, version_number)
);

-- Presentation slides table
CREATE TABLE public.meeting_presentation_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.meeting_presentation_versions(id) ON DELETE CASCADE,
  slide_number INTEGER NOT NULL,
  slide_type TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  content JSONB DEFAULT '{}',
  has_chart BOOLEAN DEFAULT false,
  has_image BOOLEAN DEFAULT false,
  image_prompt TEXT,
  is_interactive BOOLEAN DEFAULT false,
  interactive_type TEXT,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(version_id, slide_number)
);

-- Presentation logs
CREATE TABLE public.meeting_presentation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.meeting_presentations(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.meeting_presentation_versions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  performed_by UUID REFERENCES public.onboarding_staff(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_presentation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_presentation_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_presentation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view presentations" ON public.meeting_presentations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true) OR public.is_onboarding_project_member(project_id));

CREATE POLICY "Staff can create presentations" ON public.meeting_presentations FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true));

CREATE POLICY "Staff can update presentations" ON public.meeting_presentations FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true));

CREATE POLICY "Admin can delete presentations" ON public.meeting_presentations FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true AND os.role = 'admin'));

CREATE POLICY "View versions" ON public.meeting_presentation_versions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.meeting_presentations mp WHERE mp.id = presentation_id AND (EXISTS (SELECT 1 FROM public.onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true) OR (public.is_onboarding_project_member(mp.project_id) AND status = 'approved'))));

CREATE POLICY "Staff manage versions" ON public.meeting_presentation_versions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true));

CREATE POLICY "View slides" ON public.meeting_presentation_slides FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.meeting_presentation_versions mpv JOIN public.meeting_presentations mp ON mp.id = mpv.presentation_id WHERE mpv.id = version_id AND (EXISTS (SELECT 1 FROM public.onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true) OR (public.is_onboarding_project_member(mp.project_id) AND mpv.status = 'approved'))));

CREATE POLICY "Staff manage slides" ON public.meeting_presentation_slides FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true));

CREATE POLICY "Staff view logs" ON public.meeting_presentation_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true));

CREATE POLICY "Staff create logs" ON public.meeting_presentation_logs FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.onboarding_staff os WHERE os.user_id = auth.uid() AND os.is_active = true));

-- Trigger for updated_at
CREATE TRIGGER update_meeting_presentations_updated_at BEFORE UPDATE ON public.meeting_presentations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_presentations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_presentation_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_presentation_slides;