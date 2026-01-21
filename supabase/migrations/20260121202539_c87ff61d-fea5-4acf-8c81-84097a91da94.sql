-- Drop the existing constraint
ALTER TABLE public.hotseat_responses DROP CONSTRAINT IF EXISTS hotseat_responses_status_check;

-- Add updated constraint with no_show status
ALTER TABLE public.hotseat_responses ADD CONSTRAINT hotseat_responses_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]));