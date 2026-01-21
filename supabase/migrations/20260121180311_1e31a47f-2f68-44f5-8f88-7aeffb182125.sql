-- Add hotseat_response_id column to csat_surveys for Hotseat CSAT support
ALTER TABLE public.csat_surveys 
ADD COLUMN hotseat_response_id uuid REFERENCES public.hotseat_responses(id) ON DELETE CASCADE;

-- Make meeting_id nullable to support CSAT for Hotseats (which don't have meetings)
ALTER TABLE public.csat_surveys 
ALTER COLUMN meeting_id DROP NOT NULL;

-- Also update csat_responses to support hotseat responses
ALTER TABLE public.csat_responses 
ADD COLUMN hotseat_response_id uuid REFERENCES public.hotseat_responses(id) ON DELETE CASCADE;

-- Make meeting_id nullable in csat_responses as well
ALTER TABLE public.csat_responses 
ALTER COLUMN meeting_id DROP NOT NULL;

-- Add check constraint to ensure at least one reference exists (meeting_id OR hotseat_response_id)
ALTER TABLE public.csat_surveys 
ADD CONSTRAINT csat_surveys_reference_check 
CHECK (meeting_id IS NOT NULL OR hotseat_response_id IS NOT NULL);

ALTER TABLE public.csat_responses 
ADD CONSTRAINT csat_responses_reference_check 
CHECK (meeting_id IS NOT NULL OR hotseat_response_id IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX idx_csat_surveys_hotseat ON public.csat_surveys(hotseat_response_id) WHERE hotseat_response_id IS NOT NULL;
CREATE INDEX idx_csat_responses_hotseat ON public.csat_responses(hotseat_response_id) WHERE hotseat_response_id IS NOT NULL;