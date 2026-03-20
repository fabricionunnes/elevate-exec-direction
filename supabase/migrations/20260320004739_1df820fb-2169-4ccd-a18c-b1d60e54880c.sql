
ALTER TABLE public.crm_activities 
ADD COLUMN IF NOT EXISTS meeting_link text DEFAULT NULL;
