
CREATE TABLE public.whatsapp_default_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE DEFAULT 'default_instance',
  setting_value TEXT NOT NULL DEFAULT 'fabricionunnes',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users
);

-- Insert default value
INSERT INTO public.whatsapp_default_config (setting_key, setting_value)
VALUES ('default_instance', 'fabricionunnes');

-- RLS
ALTER TABLE public.whatsapp_default_config ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "Authenticated users can read whatsapp config"
  ON public.whatsapp_default_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update
CREATE POLICY "Admins can update whatsapp config"
  ON public.whatsapp_default_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'master')
    )
  );

CREATE POLICY "Admins can insert whatsapp config"
  ON public.whatsapp_default_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'master')
    )
  );
