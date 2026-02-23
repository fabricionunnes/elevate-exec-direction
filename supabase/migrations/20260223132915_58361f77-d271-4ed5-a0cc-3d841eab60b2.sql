CREATE TABLE public.pagarme_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_document TEXT,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  installments INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  pagarme_order_id TEXT,
  pagarme_charge_id TEXT,
  pix_qr_code TEXT,
  pix_qr_code_url TEXT,
  pix_expires_at TIMESTAMPTZ,
  boleto_url TEXT,
  boleto_barcode TEXT,
  boleto_due_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pagarme_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create orders" ON public.pagarme_orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all orders" ON public.pagarme_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  );

CREATE TRIGGER update_pagarme_orders_updated_at
  BEFORE UPDATE ON public.pagarme_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.portal_update_updated_at();