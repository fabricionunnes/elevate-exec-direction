
-- Table for tracking individual retention attempts
CREATE TABLE public.retention_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.onboarding_staff(id),
  attempt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  strategy TEXT,
  notes TEXT,
  result TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.retention_attempts ENABLE ROW LEVEL SECURITY;

-- RLS policies - only staff can manage
CREATE POLICY "Staff can view retention attempts"
  ON public.retention_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Staff can insert retention attempts"
  ON public.retention_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Staff can update retention attempts"
  ON public.retention_attempts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Staff can delete retention attempts"
  ON public.retention_attempts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('admin', 'master')
    )
  );
