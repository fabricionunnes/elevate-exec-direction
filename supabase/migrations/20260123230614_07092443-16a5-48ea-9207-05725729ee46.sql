-- Create storage bucket for academy cover images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('academy-covers', 'academy-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view cover images (public bucket)
CREATE POLICY "Academy covers are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'academy-covers');

-- Allow authenticated users with admin role to upload covers
CREATE POLICY "Admins can upload academy covers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'academy-covers');

-- Allow admins to update covers
CREATE POLICY "Admins can update academy covers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'academy-covers');

-- Allow admins to delete covers
CREATE POLICY "Admins can delete academy covers"
ON storage.objects FOR DELETE
USING (bucket_id = 'academy-covers');