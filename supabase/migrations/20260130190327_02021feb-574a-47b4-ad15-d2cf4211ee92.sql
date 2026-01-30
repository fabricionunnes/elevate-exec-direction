-- Create storage bucket for WhatsApp media files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media', 
  'whatsapp-media', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/3gpp', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/ogg; codecs=opus', 'application/pdf', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Create public read policy for WhatsApp media
CREATE POLICY "Public read access for whatsapp media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Create service role upload policy (for edge functions)
CREATE POLICY "Service role can upload whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media');

-- Create service role update policy
CREATE POLICY "Service role can update whatsapp media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'whatsapp-media');