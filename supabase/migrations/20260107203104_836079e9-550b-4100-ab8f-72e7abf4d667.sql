-- Create table for historical sales data (before KPI system)
CREATE TABLE public.company_sales_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.onboarding_companies(id) ON DELETE CASCADE,
  month_year DATE NOT NULL, -- First day of the month (e.g., 2024-01-01)
  revenue NUMERIC NOT NULL DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  notes TEXT,
  is_pre_unv BOOLEAN DEFAULT true, -- True = before joining UNV
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, month_year)
);

-- Enable RLS
ALTER TABLE public.company_sales_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Staff can view all sales history"
ON public.company_sales_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can insert sales history"
ON public.company_sales_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can update sales history"
ON public.company_sales_history
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can delete sales history"
ON public.company_sales_history
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_company_sales_history_updated_at
BEFORE UPDATE ON public.company_sales_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_sales_history;