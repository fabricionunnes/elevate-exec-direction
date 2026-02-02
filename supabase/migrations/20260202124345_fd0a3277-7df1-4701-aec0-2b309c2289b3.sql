-- Drop existing FK constraint
ALTER TABLE crm_leads DROP CONSTRAINT IF EXISTS crm_leads_product_id_fkey;

-- Add new FK constraint to reference onboarding_services
ALTER TABLE crm_leads 
ADD CONSTRAINT crm_leads_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES onboarding_services(id) ON DELETE SET NULL;