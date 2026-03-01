
CREATE TABLE public.financial_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  contact_name TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financial admins can manage suppliers"
  ON public.financial_suppliers
  FOR ALL
  USING (public.is_financial_admin())
  WITH CHECK (public.is_financial_admin());
