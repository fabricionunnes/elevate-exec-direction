-- Drop the old constraint and add a new one that includes 'received'
ALTER TABLE crm_whatsapp_messages DROP CONSTRAINT crm_whatsapp_messages_status_check;

ALTER TABLE crm_whatsapp_messages ADD CONSTRAINT crm_whatsapp_messages_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'received'::text]));