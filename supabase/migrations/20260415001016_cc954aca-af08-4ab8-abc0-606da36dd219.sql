
-- Add landing page fields to service_catalog
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS landing_page_config JSONB DEFAULT '{}';

-- Generate slugs from menu_key for existing records
UPDATE public.service_catalog SET slug = REPLACE(menu_key, '_', '-') WHERE slug IS NULL;

-- Create table for public (unauthenticated) purchases
CREATE TABLE public.public_service_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_catalog_id UUID NOT NULL REFERENCES public.service_catalog(id),
  menu_key TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  buyer_document TEXT,
  amount_cents INTEGER NOT NULL,
  billing_type TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'pending_payment',
  asaas_customer_id TEXT,
  asaas_payment_id TEXT,
  asaas_subscription_id TEXT,
  invoice_url TEXT,
  pix_qr_code TEXT,
  pix_qr_code_url TEXT,
  company_id UUID,
  project_id UUID,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.public_service_purchases ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public purchase)
CREATE POLICY "Anyone can create public purchases"
  ON public.public_service_purchases
  FOR INSERT
  WITH CHECK (true);

-- Only authenticated staff can read
CREATE POLICY "Authenticated users can read public purchases"
  ON public.public_service_purchases
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role can update (for webhook processing)
CREATE POLICY "Service role can update public purchases"
  ON public.public_service_purchases
  FOR UPDATE
  USING (true);

-- Allow anon to read service_catalog for public pages
CREATE POLICY "Anyone can read active public services"
  ON public.service_catalog
  FOR SELECT
  USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_public_service_purchases_updated_at
  BEFORE UPDATE ON public.public_service_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
