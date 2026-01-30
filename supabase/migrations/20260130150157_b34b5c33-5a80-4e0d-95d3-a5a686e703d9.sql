-- Add closer_staff_id column to crm_leads
ALTER TABLE public.crm_leads 
ADD COLUMN closer_staff_id UUID REFERENCES public.onboarding_staff(id);

-- Update the custom fields to be system fields that map to the columns
UPDATE public.crm_custom_fields 
SET is_system = true, field_name = 'closer_staff_id'
WHERE field_name = 'closer' AND context = 'deal';

UPDATE public.crm_custom_fields 
SET is_system = true, field_name = 'sdr_staff_id'
WHERE field_name = 'sdr' AND context = 'deal';