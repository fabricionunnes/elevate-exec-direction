-- ============ DISCADOR (Power Dialer / Twilio) ============

-- trigger genérico de updated_at p/ as tabelas do discador
CREATE OR REPLACE FUNCTION public.crm_dialer_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$fn$;

-- Campanhas de discagem
CREATE TABLE IF NOT EXISTS public.crm_dialer_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('active','paused','completed')),
  agent_staff_id UUID REFERENCES public.onboarding_staff(id),
  caller_id TEXT,
  consent_message TEXT NOT NULL DEFAULT 'Olá! Esta ligação será gravada para fins de qualidade e treinamento. Aguarde um instante que já vou transferir para um de nossos atendentes.',
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fila de leads por campanha
CREATE TABLE IF NOT EXISTS public.crm_dialer_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.crm_dialer_campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','dialing','in_call','completed','no_answer','voicemail','busy','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  position INTEGER,
  last_attempt_at TIMESTAMPTZ,
  disposition TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_dialer_queue_campaign_status ON public.crm_dialer_queue(campaign_id, status);

-- Registro de cada ligação
CREATE TABLE IF NOT EXISTS public.crm_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.crm_dialer_campaigns(id) ON DELETE SET NULL,
  queue_id UUID REFERENCES public.crm_dialer_queue(id) ON DELETE SET NULL,
  agent_staff_id UUID REFERENCES public.onboarding_staff(id),
  direction TEXT NOT NULL DEFAULT 'outbound',
  from_number TEXT,
  to_number TEXT,
  twilio_call_sid TEXT,
  conference_sid TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  answered_by TEXT,
  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  recording_url TEXT,
  recording_sid TEXT,
  transcription TEXT,
  ai_summary TEXT,
  ai_disposition TEXT,
  ai_qualification JSONB,
  notes TEXT,
  activity_id UUID REFERENCES public.crm_activities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_calls_lead ON public.crm_calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_calls_call_sid ON public.crm_calls(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_crm_calls_campaign ON public.crm_calls(campaign_id);

-- triggers updated_at
DROP TRIGGER IF EXISTS trg_dialer_campaigns_updated ON public.crm_dialer_campaigns;
CREATE TRIGGER trg_dialer_campaigns_updated BEFORE UPDATE ON public.crm_dialer_campaigns FOR EACH ROW EXECUTE FUNCTION public.crm_dialer_set_updated_at();
DROP TRIGGER IF EXISTS trg_dialer_queue_updated ON public.crm_dialer_queue;
CREATE TRIGGER trg_dialer_queue_updated BEFORE UPDATE ON public.crm_dialer_queue FOR EACH ROW EXECUTE FUNCTION public.crm_dialer_set_updated_at();
DROP TRIGGER IF EXISTS trg_crm_calls_updated ON public.crm_calls;
CREATE TRIGGER trg_crm_calls_updated BEFORE UPDATE ON public.crm_calls FOR EACH ROW EXECUTE FUNCTION public.crm_dialer_set_updated_at();

-- RLS
ALTER TABLE public.crm_dialer_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_dialer_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CRM users manage dialer campaigns" ON public.crm_dialer_campaigns;
CREATE POLICY "CRM users manage dialer campaigns" ON public.crm_dialer_campaigns FOR ALL USING (public.has_crm_access()) WITH CHECK (public.has_crm_access());
DROP POLICY IF EXISTS "CRM users manage dialer queue" ON public.crm_dialer_queue;
CREATE POLICY "CRM users manage dialer queue" ON public.crm_dialer_queue FOR ALL USING (public.has_crm_access()) WITH CHECK (public.has_crm_access());
DROP POLICY IF EXISTS "CRM users manage calls" ON public.crm_calls;
CREATE POLICY "CRM users manage calls" ON public.crm_calls FOR ALL USING (public.has_crm_access()) WITH CHECK (public.has_crm_access());

-- GRANTs de tabela (a RLS acima filtra as linhas; sem o grant o role authenticated leva "permission denied")
GRANT ALL ON public.crm_dialer_campaigns TO anon, authenticated, service_role;
GRANT ALL ON public.crm_dialer_queue TO anon, authenticated, service_role;
GRANT ALL ON public.crm_calls TO anon, authenticated, service_role;
