-- Add access_token to social_briefing_forms for public access
ALTER TABLE public.social_briefing_forms 
ADD COLUMN IF NOT EXISTS access_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

-- Update existing rows to have a token
UPDATE public.social_briefing_forms 
SET access_token = encode(gen_random_bytes(16), 'hex')
WHERE access_token IS NULL;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_social_briefing_forms_access_token 
ON public.social_briefing_forms(access_token);

-- Create RLS policy for public access via token
CREATE POLICY "Public can read briefing via token"
ON public.social_briefing_forms
FOR SELECT
USING (true);

CREATE POLICY "Public can update briefing via token"
ON public.social_briefing_forms
FOR UPDATE
USING (true);

-- Allow public insert for uploads linked to briefing
CREATE POLICY "Public can insert briefing uploads"
ON public.social_briefing_uploads
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can read briefing uploads"
ON public.social_briefing_uploads
FOR SELECT
USING (true);

CREATE POLICY "Public can delete briefing uploads"
ON public.social_briefing_uploads
FOR DELETE
USING (true);