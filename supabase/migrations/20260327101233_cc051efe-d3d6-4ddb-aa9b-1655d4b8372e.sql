
-- Create the crm-files storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-files', 'crm-files', true);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload crm files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'crm-files');

-- Allow authenticated users to read crm files
CREATE POLICY "Authenticated users can read crm files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'crm-files');

-- Allow authenticated users to delete crm files
CREATE POLICY "Authenticated users can delete crm files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'crm-files');
