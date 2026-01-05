-- Create table for CAC form responses
CREATE TABLE public.onboarding_cac_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  form_title TEXT,
  facebook_ads_investment NUMERIC,
  google_ads_investment NUMERIC,
  linkedin_ads_investment NUMERIC,
  sales_quantity_3_months INTEGER,
  sales_value_3_months NUMERIC,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_cac_forms ENABLE ROW LEVEL SECURITY;

-- Policy for staff to view all CAC forms
CREATE POLICY "Staff can view CAC forms" 
ON public.onboarding_cac_forms
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os 
    WHERE os.user_id = auth.uid() 
    AND os.is_active = true
  )
);

-- Policy for authenticated project members to view their CAC forms
CREATE POLICY "Project members can view their CAC forms" 
ON public.onboarding_cac_forms
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.project_id = onboarding_cac_forms.project_id
  )
);

-- Policy for public insert (form submission without auth)
CREATE POLICY "Anyone can submit CAC forms" 
ON public.onboarding_cac_forms
FOR INSERT 
WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX idx_cac_forms_project_id ON public.onboarding_cac_forms(project_id);