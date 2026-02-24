CREATE TABLE public.payment_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  installments INTEGER NOT NULL DEFAULT 1,
  url TEXT NOT NULL,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all payment links"
  ON public.payment_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Staff can insert payment links"
  ON public.payment_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Add payment_link_id to pagarme_orders to link orders to their source link
ALTER TABLE public.pagarme_orders ADD COLUMN IF NOT EXISTS payment_link_id UUID REFERENCES public.payment_links(id);