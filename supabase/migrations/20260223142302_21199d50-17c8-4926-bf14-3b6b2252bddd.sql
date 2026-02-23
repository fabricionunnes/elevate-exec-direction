ALTER TABLE public.pagarme_orders 
ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS webhook_event TEXT;