
-- Survey send configurations (NPS and CSAT)
CREATE TABLE public.survey_send_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_type TEXT NOT NULL CHECK (survey_type IN ('nps', 'csat')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  whatsapp_instance_name TEXT,
  -- NPS specific: frequency in days (e.g. 30 = monthly, 90 = quarterly)
  nps_frequency_days INTEGER DEFAULT 30,
  -- Max follow-ups before stopping
  max_follow_ups INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survey_type)
);

-- Survey send rules (the "régua" - each step with custom message)
CREATE TABLE public.survey_send_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.survey_send_configs(id) ON DELETE CASCADE,
  day_offset INTEGER NOT NULL DEFAULT 0,
  message_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Survey send log (track all sends and responses)
CREATE TABLE public.survey_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES public.survey_send_configs(id),
  rule_id UUID REFERENCES public.survey_send_rules(id),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.onboarding_companies(id),
  survey_type TEXT NOT NULL CHECK (survey_type IN ('nps', 'csat')),
  phone TEXT NOT NULL,
  contact_name TEXT,
  -- For NPS: the NPS link sent
  survey_link TEXT,
  -- For CSAT: meeting reference
  meeting_id UUID REFERENCES public.onboarding_meeting_notes(id),
  meeting_subject TEXT,
  -- For CSAT: csat_survey reference
  csat_survey_id UUID REFERENCES public.csat_surveys(id),
  -- For NPS: nps_response reference
  nps_response_id UUID REFERENCES public.onboarding_nps_responses(id),
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'responded', 'failed', 'stopped')),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.survey_send_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_send_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_send_log ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated staff can read/write configs
CREATE POLICY "Staff can manage survey configs" ON public.survey_send_configs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Staff can manage survey rules" ON public.survey_send_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Staff can manage survey send log" ON public.survey_send_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default NPS config
INSERT INTO public.survey_send_configs (survey_type, is_active, nps_frequency_days, max_follow_ups)
VALUES 
  ('nps', true, 30, 5),
  ('csat', true, null, 3);

-- Insert default NPS rules
INSERT INTO public.survey_send_rules (config_id, day_offset, message_template, sort_order)
SELECT c.id, r.day_offset, r.message_template, r.sort_order
FROM public.survey_send_configs c
CROSS JOIN (VALUES
  (0, 'Olá {nome}! 👋\n\nGostaríamos muito de saber sua opinião sobre nosso trabalho.\n\nPor favor, responda nossa pesquisa de satisfação (leva menos de 1 minuto):\n\n🔗 {link}\n\nSua avaliação é muito importante para nós! ⭐', 0),
  (3, 'Olá {nome}! 😊\n\nNotamos que ainda não respondeu nossa pesquisa de satisfação.\n\nSua opinião nos ajuda a melhorar continuamente:\n\n🔗 {link}\n\nLeva apenas 30 segundos! 🙏', 1),
  (7, 'Oi {nome}!\n\nÚltimo lembrete sobre nossa pesquisa de satisfação. Sua opinião é essencial:\n\n🔗 {link}\n\nAgradecemos pela colaboração! 💙', 2)
) AS r(day_offset, message_template, sort_order)
WHERE c.survey_type = 'nps';

-- Insert default CSAT rules
INSERT INTO public.survey_send_rules (config_id, day_offset, message_template, sort_order)
SELECT c.id, r.day_offset, r.message_template, r.sort_order
FROM public.survey_send_configs c
CROSS JOIN (VALUES
  (0, 'Olá {nome}! 👋\n\nAcabamos de finalizar nossa reunião sobre *{assunto_reuniao}*.\n\nGostaríamos de saber como foi sua experiência:\n\n🔗 {link}\n\nSua avaliação nos ajuda a melhorar! ⭐', 0),
  (1, 'Oi {nome}! 😊\n\nLembrando que gostaríamos muito do seu feedback sobre nossa reunião *{assunto_reuniao}*:\n\n🔗 {link}\n\nLeva menos de 1 minuto! 🙏', 1),
  (3, 'Olá {nome}!\n\nÚltimo lembrete sobre a pesquisa de satisfação da reunião *{assunto_reuniao}*:\n\n🔗 {link}\n\nAgradecemos! 💙', 2)
) AS r(day_offset, message_template, sort_order)
WHERE c.survey_type = 'csat';

-- Enable realtime for monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.survey_send_log;
