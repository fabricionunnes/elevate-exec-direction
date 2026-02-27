
CREATE TABLE public.billing_notification_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('before', 'on_due', 'after')),
  days_offset INTEGER NOT NULL DEFAULT 0,
  message_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  include_payment_link BOOLEAN NOT NULL DEFAULT true,
  include_interest_info BOOLEAN NOT NULL DEFAULT true,
  include_discount_info BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage billing rules" ON public.billing_notification_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'master')
    )
  );

CREATE TABLE public.billing_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID REFERENCES public.billing_notification_rules(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.company_invoices(id) ON DELETE SET NULL,
  company_id UUID NOT NULL,
  phone TEXT,
  message_sent TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view billing logs" ON public.billing_notification_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'master')
    )
  );
