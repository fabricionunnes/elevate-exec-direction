-- Create company_units table for branches/units
CREATE TABLE public.company_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add unit_id to kpi_entries to track entries by unit
ALTER TABLE public.kpi_entries ADD COLUMN unit_id UUID REFERENCES public.company_units(id) ON DELETE SET NULL;

-- Add unit_id to company_salespeople to assign salespeople to units
ALTER TABLE public.company_salespeople ADD COLUMN unit_id UUID REFERENCES public.company_units(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.company_units ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_units (similar to other KPI tables)
CREATE POLICY "Staff can view all company units"
ON public.company_units FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Staff can manage company units"
ON public.company_units FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
);

-- Policy for clients to view units of their companies
CREATE POLICY "Clients can view their company units"
ON public.company_units FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT op.onboarding_company_id
    FROM public.onboarding_users ou
    JOIN public.onboarding_projects op ON op.id = ou.project_id
    WHERE ou.user_id = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX idx_company_units_company_id ON public.company_units(company_id);
CREATE INDEX idx_kpi_entries_unit_id ON public.kpi_entries(unit_id);
CREATE INDEX idx_company_salespeople_unit_id ON public.company_salespeople(unit_id);

-- Add trigger for updated_at
CREATE TRIGGER update_company_units_updated_at
BEFORE UPDATE ON public.company_units
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();