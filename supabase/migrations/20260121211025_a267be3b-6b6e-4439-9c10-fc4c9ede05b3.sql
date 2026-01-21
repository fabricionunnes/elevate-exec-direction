-- Add abc_curve column to client_financial_products
ALTER TABLE public.client_financial_products 
ADD COLUMN abc_curve text DEFAULT NULL;

-- Add constraint to ensure valid values
ALTER TABLE public.client_financial_products 
ADD CONSTRAINT client_financial_products_abc_curve_check 
CHECK (abc_curve IS NULL OR abc_curve IN ('A', 'B', 'C'));