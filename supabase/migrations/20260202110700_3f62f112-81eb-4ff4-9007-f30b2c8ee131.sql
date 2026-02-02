-- Add new columns to crm_stage_checklists for item type and templates
ALTER TABLE public.crm_stage_checklists 
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'instruction',
ADD COLUMN IF NOT EXISTS whatsapp_template TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.crm_stage_checklists.item_type IS 'Type of checklist item: instruction, call, whatsapp';
COMMENT ON COLUMN public.crm_stage_checklists.whatsapp_template IS 'WhatsApp message template with variables like {{nome_cliente}}';