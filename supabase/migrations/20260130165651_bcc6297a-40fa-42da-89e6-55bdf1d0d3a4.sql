-- Contatos WhatsApp
CREATE TABLE crm_whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversas
CREATE TABLE crm_whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_whatsapp_contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  assigned_to UUID REFERENCES onboarding_staff(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  sector_id UUID REFERENCES crm_service_sectors(id) ON DELETE SET NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Mensagens
CREATE TABLE crm_whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES crm_whatsapp_conversations(id) ON DELETE CASCADE,
  remote_id TEXT,
  content TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'audio', 'video', 'document', 'sticker')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  media_url TEXT,
  media_mimetype TEXT,
  quoted_message_id UUID REFERENCES crm_whatsapp_messages(id),
  sent_by UUID REFERENCES onboarding_staff(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE crm_whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contacts
CREATE POLICY "Staff can view whatsapp contacts" ON crm_whatsapp_contacts
  FOR SELECT USING (true);

CREATE POLICY "Staff can insert whatsapp contacts" ON crm_whatsapp_contacts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can update whatsapp contacts" ON crm_whatsapp_contacts
  FOR UPDATE USING (true);

-- RLS Policies for conversations
CREATE POLICY "Staff can view whatsapp conversations" ON crm_whatsapp_conversations
  FOR SELECT USING (true);

CREATE POLICY "Staff can insert whatsapp conversations" ON crm_whatsapp_conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can update whatsapp conversations" ON crm_whatsapp_conversations
  FOR UPDATE USING (true);

CREATE POLICY "Staff can delete whatsapp conversations" ON crm_whatsapp_conversations
  FOR DELETE USING (true);

-- RLS Policies for messages
CREATE POLICY "Staff can view whatsapp messages" ON crm_whatsapp_messages
  FOR SELECT USING (true);

CREATE POLICY "Staff can insert whatsapp messages" ON crm_whatsapp_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can update whatsapp messages" ON crm_whatsapp_messages
  FOR UPDATE USING (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE crm_whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_whatsapp_messages;

-- Índices para performance
CREATE INDEX idx_whatsapp_conversations_instance ON crm_whatsapp_conversations(instance_id);
CREATE INDEX idx_whatsapp_conversations_assigned ON crm_whatsapp_conversations(assigned_to);
CREATE INDEX idx_whatsapp_conversations_status ON crm_whatsapp_conversations(status);
CREATE INDEX idx_whatsapp_messages_conversation ON crm_whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_created ON crm_whatsapp_messages(created_at DESC);
CREATE INDEX idx_whatsapp_contacts_phone ON crm_whatsapp_contacts(phone);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crm_whatsapp_contacts_updated_at
  BEFORE UPDATE ON crm_whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

CREATE TRIGGER update_crm_whatsapp_conversations_updated_at
  BEFORE UPDATE ON crm_whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();