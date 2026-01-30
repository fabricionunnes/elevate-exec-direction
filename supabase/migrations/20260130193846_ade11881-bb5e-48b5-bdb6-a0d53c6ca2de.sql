-- Add document field (CPF/CNPJ) to crm_leads
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS document TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.crm_leads.document IS 'CPF or CNPJ of the lead';

-- Create index for faster lookups by phone, email and document
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone ON public.crm_leads(phone);
CREATE INDEX IF NOT EXISTS idx_crm_leads_email ON public.crm_leads(email);
CREATE INDEX IF NOT EXISTS idx_crm_leads_document ON public.crm_leads(document);

-- Add lead_id reference to whatsapp contacts for direct linking
ALTER TABLE public.crm_whatsapp_contacts 
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_whatsapp_contacts_lead_id ON public.crm_whatsapp_contacts(lead_id);