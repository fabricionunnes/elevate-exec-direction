
-- Create storage bucket for slide media
INSERT INTO storage.buckets (id, name, public)
VALUES ('slide-media', 'slide-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to slide-media bucket
CREATE POLICY "Authenticated users can upload slide media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'slide-media');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update slide media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'slide-media');

-- Allow anyone to view slide media (public bucket)
CREATE POLICY "Anyone can view slide media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'slide-media');

-- Allow authenticated users to delete slide media
CREATE POLICY "Authenticated users can delete slide media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'slide-media');
