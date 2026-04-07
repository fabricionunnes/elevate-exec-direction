
-- Helper functions
CREATE OR REPLACE FUNCTION public.is_staff_admin_or_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'master')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_current_staff_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.onboarding_staff
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1
$$;

-- 1. Staff WhatsApp Instances
CREATE TABLE public.staff_whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  display_name TEXT,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, instance_name)
);
ALTER TABLE public.staff_whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swi_select" ON public.staff_whatsapp_instances FOR SELECT USING (staff_id = public.get_current_staff_id() OR public.is_staff_admin_or_master());
CREATE POLICY "swi_insert" ON public.staff_whatsapp_instances FOR INSERT WITH CHECK (staff_id = public.get_current_staff_id());
CREATE POLICY "swi_update" ON public.staff_whatsapp_instances FOR UPDATE USING (staff_id = public.get_current_staff_id() OR public.is_staff_admin_or_master());
CREATE POLICY "swi_delete" ON public.staff_whatsapp_instances FOR DELETE USING (staff_id = public.get_current_staff_id() OR public.is_staff_admin_or_master());

-- 2. Access Grants (before conversations)
CREATE TABLE public.staff_whatsapp_access_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  granter_staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  grantee_staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.onboarding_staff(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(granter_staff_id, grantee_staff_id)
);
ALTER TABLE public.staff_whatsapp_access_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swag_admin" ON public.staff_whatsapp_access_grants FOR ALL TO authenticated USING (public.is_staff_admin_or_master());
CREATE POLICY "swag_view" ON public.staff_whatsapp_access_grants FOR SELECT TO authenticated USING (granter_staff_id = public.get_current_staff_id() OR grantee_staff_id = public.get_current_staff_id());

-- 3. Conversations
CREATE TABLE public.staff_whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.staff_whatsapp_instances(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_phone TEXT NOT NULL,
  contact_photo_url TEXT,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swc_select" ON public.staff_whatsapp_conversations FOR SELECT USING (
  staff_id = public.get_current_staff_id() OR public.is_staff_admin_or_master()
  OR EXISTS (SELECT 1 FROM public.staff_whatsapp_access_grants WHERE granter_staff_id = staff_whatsapp_conversations.staff_id AND grantee_staff_id = public.get_current_staff_id() AND is_active = true)
);
CREATE POLICY "swc_insert" ON public.staff_whatsapp_conversations FOR INSERT WITH CHECK (staff_id = public.get_current_staff_id());
CREATE POLICY "swc_update" ON public.staff_whatsapp_conversations FOR UPDATE USING (staff_id = public.get_current_staff_id() OR public.is_staff_admin_or_master());
CREATE POLICY "swc_delete" ON public.staff_whatsapp_conversations FOR DELETE USING (staff_id = public.get_current_staff_id() OR public.is_staff_admin_or_master());
CREATE INDEX idx_staff_wa_conv_staff ON public.staff_whatsapp_conversations(staff_id);
CREATE INDEX idx_staff_wa_conv_project ON public.staff_whatsapp_conversations(project_id);
CREATE INDEX idx_staff_wa_conv_last_msg ON public.staff_whatsapp_conversations(last_message_at DESC NULLS LAST);

-- 4. Messages
CREATE TABLE public.staff_whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.staff_whatsapp_conversations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  direction TEXT NOT NULL DEFAULT 'outgoing',
  status TEXT NOT NULL DEFAULT 'sent',
  remote_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swm_select" ON public.staff_whatsapp_messages FOR SELECT USING (
  staff_id = public.get_current_staff_id() OR public.is_staff_admin_or_master()
  OR EXISTS (SELECT 1 FROM public.staff_whatsapp_access_grants WHERE granter_staff_id = staff_whatsapp_messages.staff_id AND grantee_staff_id = public.get_current_staff_id() AND is_active = true)
);
CREATE POLICY "swm_insert" ON public.staff_whatsapp_messages FOR INSERT WITH CHECK (staff_id = public.get_current_staff_id());
CREATE INDEX idx_staff_wa_msg_conv ON public.staff_whatsapp_messages(conversation_id);
CREATE INDEX idx_staff_wa_msg_created ON public.staff_whatsapp_messages(created_at);

-- 5. Tags
CREATE TABLE public.staff_whatsapp_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_whatsapp_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swt_select" ON public.staff_whatsapp_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "swt_admin" ON public.staff_whatsapp_tags FOR ALL TO authenticated USING (public.is_staff_admin_or_master());
INSERT INTO public.staff_whatsapp_tags (name, color) VALUES ('Lead','#3b82f6'),('Cliente','#22c55e'),('Proposta Enviada','#f59e0b'),('Follow-up','#8b5cf6'),('Fechado','#ef4444');

-- 6. Conversation Tags
CREATE TABLE public.staff_whatsapp_conversation_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.staff_whatsapp_conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.staff_whatsapp_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, tag_id)
);
ALTER TABLE public.staff_whatsapp_conversation_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swct_select" ON public.staff_whatsapp_conversation_tags FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.staff_whatsapp_conversations c WHERE c.id = conversation_id AND (c.staff_id = public.get_current_staff_id() OR public.is_staff_admin_or_master()))
);
CREATE POLICY "swct_all" ON public.staff_whatsapp_conversation_tags FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.staff_whatsapp_conversations c WHERE c.id = conversation_id AND (c.staff_id = public.get_current_staff_id() OR public.is_staff_admin_or_master()))
);

-- 7. Connection Logs
CREATE TABLE public.staff_whatsapp_connection_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.staff_whatsapp_instances(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_whatsapp_connection_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swcl_select" ON public.staff_whatsapp_connection_logs FOR SELECT USING (staff_id = public.get_current_staff_id() OR public.is_staff_admin_or_master());
CREATE POLICY "swcl_insert" ON public.staff_whatsapp_connection_logs FOR INSERT WITH CHECK (staff_id = public.get_current_staff_id());
CREATE INDEX idx_staff_wa_log_instance ON public.staff_whatsapp_connection_logs(instance_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_whatsapp_messages;
