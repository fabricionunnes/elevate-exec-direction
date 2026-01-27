-- Create storage bucket for Circle media (testimonial images, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('circle-media', 'circle-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for circle-media bucket
CREATE POLICY "Anyone can view circle-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'circle-media');

CREATE POLICY "Authenticated users can upload circle-media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'circle-media' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete own circle-media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'circle-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add image_url column to circle_testimonials if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'circle_testimonials' 
    AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.circle_testimonials ADD COLUMN image_url TEXT;
  END IF;
END $$;