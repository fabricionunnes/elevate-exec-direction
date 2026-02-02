
-- Drop the foreign key constraint that references onboarding_staff
ALTER TABLE public.whatsapp_campaigns 
DROP CONSTRAINT whatsapp_campaigns_created_by_fkey;

-- Add a comment to clarify the column now stores auth.uid() directly
COMMENT ON COLUMN public.whatsapp_campaigns.created_by IS 'UUID from auth.users (auth.uid()) - used for RLS isolation';
