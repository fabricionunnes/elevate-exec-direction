ALTER TABLE public.crm_leads 
  ADD COLUMN IF NOT EXISTS head_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS head_closing_date date DEFAULT NULL;