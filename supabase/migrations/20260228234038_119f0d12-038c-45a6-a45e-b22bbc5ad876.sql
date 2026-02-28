ALTER TABLE public.company_recurring_charges 
  ADD COLUMN category_id UUID REFERENCES public.financial_categories(id) DEFAULT NULL,
  ADD COLUMN cost_center_id UUID REFERENCES public.staff_financial_cost_centers(id) DEFAULT NULL;