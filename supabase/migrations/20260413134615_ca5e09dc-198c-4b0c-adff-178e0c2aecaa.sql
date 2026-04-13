
-- Table: CRM Notification Rules
CREATE TABLE public.crm_notification_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- lead_created, stage_changed, lead_won, lead_lost, lead_inactive, meeting_scheduled
  pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.crm_stages(id) ON DELETE SET NULL,
  whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read crm_notification_rules"
  ON public.crm_notification_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert crm_notification_rules"
  ON public.crm_notification_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update crm_notification_rules"
  ON public.crm_notification_rules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete crm_notification_rules"
  ON public.crm_notification_rules FOR DELETE TO authenticated USING (true);

-- Table: CRM Notification Rule Messages (sequence)
CREATE TABLE public.crm_notification_rule_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.crm_notification_rules(id) ON DELETE CASCADE,
  message_template TEXT NOT NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0, -- 0 = imediato
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_notification_rule_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read crm_notification_rule_messages"
  ON public.crm_notification_rule_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert crm_notification_rule_messages"
  ON public.crm_notification_rule_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update crm_notification_rule_messages"
  ON public.crm_notification_rule_messages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete crm_notification_rule_messages"
  ON public.crm_notification_rule_messages FOR DELETE TO authenticated USING (true);

-- Table: CRM Notification Queue (scheduled messages)
CREATE TABLE public.crm_notification_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.crm_notification_rules(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.crm_notification_rule_messages(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message_text TEXT NOT NULL,
  whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read crm_notification_queue"
  ON public.crm_notification_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert crm_notification_queue"
  ON public.crm_notification_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update crm_notification_queue"
  ON public.crm_notification_queue FOR UPDATE TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX idx_crm_notification_rules_pipeline ON public.crm_notification_rules(pipeline_id);
CREATE INDEX idx_crm_notification_rules_trigger ON public.crm_notification_rules(trigger_type);
CREATE INDEX idx_crm_notification_queue_status ON public.crm_notification_queue(status, scheduled_at);
CREATE INDEX idx_crm_notification_queue_lead ON public.crm_notification_queue(lead_id);
