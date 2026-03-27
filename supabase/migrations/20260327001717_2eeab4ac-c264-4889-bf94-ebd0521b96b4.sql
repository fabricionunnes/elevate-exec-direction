
CREATE TABLE public.gamification_report_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gamification_report_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read gamification_report_config"
ON public.gamification_report_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert gamification_report_config"
ON public.gamification_report_config FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update gamification_report_config"
ON public.gamification_report_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Insert default config rows
INSERT INTO public.gamification_report_config (setting_key, setting_value) VALUES
  ('enabled', 'false'),
  ('instance_id', null),
  ('group_jid', null),
  ('send_time', '08:00');
