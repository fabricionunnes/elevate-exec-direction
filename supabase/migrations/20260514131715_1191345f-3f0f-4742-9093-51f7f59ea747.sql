ALTER TABLE public.crm_whatsapp_messages
  ADD COLUMN IF NOT EXISTS sender_phone text,
  ADD COLUMN IF NOT EXISTS sender_name text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sender_phone
  ON public.crm_whatsapp_messages (sender_phone);