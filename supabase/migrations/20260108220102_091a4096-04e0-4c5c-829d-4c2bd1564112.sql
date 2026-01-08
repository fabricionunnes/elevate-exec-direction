-- Add target_revenue column for historical sales targets
ALTER TABLE public.company_sales_history 
ADD COLUMN IF NOT EXISTS target_revenue numeric DEFAULT NULL;