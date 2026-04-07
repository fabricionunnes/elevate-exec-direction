-- Create storage bucket for WhatsApp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Staff can upload whatsapp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Allow public read
CREATE POLICY "Public read whatsapp media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Staff can delete whatsapp media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media');
