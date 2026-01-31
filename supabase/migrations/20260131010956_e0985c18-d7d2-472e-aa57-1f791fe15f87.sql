-- Tabela de campanhas de disparo
CREATE TABLE public.whatsapp_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  delay_between_messages INTEGER DEFAULT 3, -- seconds between each message
  created_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de destinatários da campanha
CREATE TABLE public.whatsapp_campaign_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  company TEXT,
  custom_vars JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_campaign_recipients_campaign ON public.whatsapp_campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_status ON public.whatsapp_campaign_recipients(status);
CREATE INDEX idx_campaigns_status ON public.whatsapp_campaigns(status);
CREATE INDEX idx_campaigns_scheduled ON public.whatsapp_campaigns(scheduled_at) WHERE status = 'scheduled';

-- Enable RLS
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para campanhas
CREATE POLICY "Staff can view campaigns"
  ON public.whatsapp_campaigns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins and masters can manage campaigns"
  ON public.whatsapp_campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND role IN ('admin', 'master') AND is_active = true
    )
  );

-- Políticas de RLS para destinatários
CREATE POLICY "Staff can view campaign recipients"
  ON public.whatsapp_campaign_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins and masters can manage campaign recipients"
  ON public.whatsapp_campaign_recipients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND role IN ('admin', 'master') AND is_active = true
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_campaigns_updated_at
  BEFORE UPDATE ON public.whatsapp_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime para atualizações ao vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_campaign_recipients;