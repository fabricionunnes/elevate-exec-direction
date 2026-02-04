-- Add address field to crm_leads
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS address TEXT;