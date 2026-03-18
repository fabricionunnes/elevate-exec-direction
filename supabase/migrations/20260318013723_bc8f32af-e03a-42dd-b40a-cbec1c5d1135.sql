CREATE TABLE public.crm_lead_notification_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_lead_notification_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage notification numbers"
  ON public.crm_lead_notification_numbers
  FOR ALL
  TO authenticated
  USING (public.is_crm_admin())
  WITH CHECK (public.is_crm_admin());