-- Drop existing RLS policies for social_briefing_forms that don't support anon
DROP POLICY IF EXISTS "Public can read briefing via token" ON public.social_briefing_forms;
DROP POLICY IF EXISTS "Public can update briefing via token" ON public.social_briefing_forms;

-- Create new policies that explicitly allow anon role
CREATE POLICY "Anon can read briefing via token"
ON public.social_briefing_forms
FOR SELECT
TO anon, authenticated
USING (access_token IS NOT NULL);

CREATE POLICY "Anon can update briefing via token"
ON public.social_briefing_forms
FOR UPDATE
TO anon, authenticated
USING (access_token IS NOT NULL)
WITH CHECK (access_token IS NOT NULL);

-- Drop and recreate upload policies for anon access
DROP POLICY IF EXISTS "Public can read briefing uploads" ON public.social_briefing_uploads;
DROP POLICY IF EXISTS "Public can insert briefing uploads" ON public.social_briefing_uploads;
DROP POLICY IF EXISTS "Public can delete briefing uploads" ON public.social_briefing_uploads;

CREATE POLICY "Anon can read briefing uploads"
ON public.social_briefing_uploads
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anon can insert briefing uploads"
ON public.social_briefing_uploads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anon can delete briefing uploads"
ON public.social_briefing_uploads
FOR DELETE
TO anon, authenticated
USING (true);

-- Storage policies for social-briefing bucket (allow anon uploads)
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-briefing', 'social-briefing', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing storage policies if any
DROP POLICY IF EXISTS "Public read social briefing files" ON storage.objects;
DROP POLICY IF EXISTS "Public upload social briefing files" ON storage.objects;
DROP POLICY IF EXISTS "Public delete social briefing files" ON storage.objects;

-- Create storage policies that allow anon access
CREATE POLICY "Public read social briefing files"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'social-briefing');

CREATE POLICY "Public upload social briefing files"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'social-briefing');

CREATE POLICY "Public delete social briefing files"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'social-briefing');