-- Add pdf_url column to pdi_books
ALTER TABLE public.pdi_books ADD COLUMN pdf_url text;

-- Create storage bucket for PDI books
INSERT INTO storage.buckets (id, name, public) VALUES ('pdi-books', 'pdi-books', true);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload PDI books" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pdi-books');

-- Allow public read
CREATE POLICY "Public can read PDI books" ON storage.objects
FOR SELECT USING (bucket_id = 'pdi-books');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete PDI books" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'pdi-books');