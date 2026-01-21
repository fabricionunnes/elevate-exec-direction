-- Add seller fields to client_inventory_sales
ALTER TABLE public.client_inventory_sales
ADD COLUMN IF NOT EXISTS seller_name text,
ADD COLUMN IF NOT EXISTS seller_id uuid;