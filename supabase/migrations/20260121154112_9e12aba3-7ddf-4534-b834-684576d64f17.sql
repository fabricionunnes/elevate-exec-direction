-- Add payment_status column to client_inventory_sales
ALTER TABLE public.client_inventory_sales
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'paid';

-- Update existing records to have payment_status based on status
UPDATE public.client_inventory_sales
SET payment_status = 'paid'
WHERE payment_status IS NULL;