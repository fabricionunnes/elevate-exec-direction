-- Remove the existing check constraint on type column
ALTER TABLE public.client_financial_categories 
DROP CONSTRAINT IF EXISTS client_financial_categories_type_check;

-- Add updated check constraint that includes 'product'
ALTER TABLE public.client_financial_categories 
ADD CONSTRAINT client_financial_categories_type_check 
CHECK (type IN ('income', 'expense', 'product'));