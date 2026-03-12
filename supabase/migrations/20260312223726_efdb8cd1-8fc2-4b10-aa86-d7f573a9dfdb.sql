
CREATE TABLE public.distratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.onboarding_companies(id),
  company_name TEXT NOT NULL,
  company_cnpj TEXT,
  company_address TEXT,
  legal_rep_name TEXT,
  project_id UUID REFERENCES public.onboarding_projects(id),
  project_name TEXT,
  contract_date TEXT,
  service_description TEXT,
  distrato_date DATE NOT NULL DEFAULT CURRENT_DATE,
  additional_notes TEXT,
  clauses_snapshot JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.distratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage distratos" ON public.distratos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
