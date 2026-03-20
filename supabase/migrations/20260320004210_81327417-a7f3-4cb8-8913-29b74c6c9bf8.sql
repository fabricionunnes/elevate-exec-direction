
-- Add whatsapp_attachments column to store file URLs as JSONB array
ALTER TABLE public.crm_stage_checklists 
ADD COLUMN IF NOT EXISTS whatsapp_attachments jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for checklist attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('checklist-attachments', 'checklist-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to the bucket
CREATE POLICY "Authenticated users can upload checklist attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'checklist-attachments');

-- Allow public read access
CREATE POLICY "Public read access for checklist attachments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'checklist-attachments');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete checklist attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'checklist-attachments');
