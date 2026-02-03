-- Drop the existing constraint and add a new one that includes 'note'
ALTER TABLE public.crm_activities DROP CONSTRAINT crm_activities_type_check;

ALTER TABLE public.crm_activities ADD CONSTRAINT crm_activities_type_check 
CHECK (type = ANY (ARRAY['call'::text, 'whatsapp'::text, 'email'::text, 'meeting'::text, 'followup'::text, 'proposal'::text, 'other'::text, 'note'::text]));