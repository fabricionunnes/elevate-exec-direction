-- Create storage bucket for contract PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contract-pdfs', 'contract-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to contract PDFs
CREATE POLICY "Contract PDFs are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'contract-pdfs');

-- Allow anyone to upload contract PDFs
CREATE POLICY "Anyone can upload contract PDFs" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'contract-pdfs');