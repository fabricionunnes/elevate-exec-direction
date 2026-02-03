-- Create table for official WhatsApp API instances
CREATE TABLE public.whatsapp_official_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name TEXT NOT NULL,
  waba_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  phone_number TEXT,
  webhook_verify_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'disconnected', 'error')),
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_official_instances ENABLE ROW LEVEL SECURITY;

-- Policies for staff access
CREATE POLICY "Staff can view official instances"
  ON public.whatsapp_official_instances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM onboarding_staff s
      WHERE s.user_id = auth.uid()
      AND s.is_active = true
    )
  );

CREATE POLICY "Staff can insert official instances"
  ON public.whatsapp_official_instances
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM onboarding_staff s
      WHERE s.user_id = auth.uid()
      AND s.is_active = true
      AND s.role IN ('master', 'admin')
    )
  );

CREATE POLICY "Staff can update official instances"
  ON public.whatsapp_official_instances
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM onboarding_staff s
      WHERE s.user_id = auth.uid()
      AND s.is_active = true
      AND s.role IN ('master', 'admin')
    )
  );

CREATE POLICY "Staff can delete official instances"
  ON public.whatsapp_official_instances
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM onboarding_staff s
      WHERE s.user_id = auth.uid()
      AND s.is_active = true
      AND s.role = 'master'
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_whatsapp_official_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_official_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add column to conversations to track which official instance it belongs to
ALTER TABLE public.crm_whatsapp_conversations
ADD COLUMN IF NOT EXISTS official_instance_id UUID REFERENCES public.whatsapp_official_instances(id);

-- Add column to messages to store whatsapp message id for status updates
ALTER TABLE public.crm_whatsapp_messages
ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;