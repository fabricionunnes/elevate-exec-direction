-- Update existing custom fields CPF and CNPJ to be system fields mapping to document column
-- We'll use a single document field instead of separate cpf/cnpj custom fields

-- First, update the existing CPF field to be a system field
UPDATE public.crm_custom_fields 
SET 
  is_system = true,
  field_name = 'document',
  field_label = 'CPF/CNPJ'
WHERE id = '272df1f9-5fcd-4fc6-ac97-1e1d834ae182';

-- Deactivate the CNPJ field since we're consolidating into document
UPDATE public.crm_custom_fields 
SET is_active = false
WHERE id = 'b3466b71-9393-421f-9de6-5f3e78a64d75';

-- Migrate any existing values from custom field values to the document column
UPDATE public.crm_leads l
SET document = (
  SELECT value FROM public.crm_custom_field_values v 
  WHERE v.lead_id = l.id 
  AND v.field_id IN ('272df1f9-5fcd-4fc6-ac97-1e1d834ae182', 'b3466b71-9393-421f-9de6-5f3e78a64d75')
  AND v.value IS NOT NULL
  LIMIT 1
)
WHERE l.document IS NULL
AND EXISTS (
  SELECT 1 FROM public.crm_custom_field_values v 
  WHERE v.lead_id = l.id 
  AND v.field_id IN ('272df1f9-5fcd-4fc6-ac97-1e1d834ae182', 'b3466b71-9393-421f-9de6-5f3e78a64d75')
  AND v.value IS NOT NULL
);