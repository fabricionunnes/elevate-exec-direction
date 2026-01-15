-- Drop old constraint and create new one with 'salesperson' included
ALTER TABLE public.customer_points_transactions
DROP CONSTRAINT IF EXISTS customer_points_transactions_source_check;

ALTER TABLE public.customer_points_transactions
ADD CONSTRAINT customer_points_transactions_source_check
CHECK (source IN ('manual', 'qr_code', 'salesperson'));