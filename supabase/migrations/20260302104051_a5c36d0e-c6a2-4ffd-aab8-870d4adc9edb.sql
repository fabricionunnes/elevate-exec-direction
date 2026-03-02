ALTER TABLE public.payment_links ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'pagarme';
ALTER TABLE public.pagarme_orders ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'pagarme';