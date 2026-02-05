-- Create table for multiple approval contacts
CREATE TABLE public.social_approval_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for project lookup
CREATE INDEX idx_social_approval_contacts_project ON public.social_approval_contacts(project_id);

-- Add approval settings to boards table
ALTER TABLE public.social_content_boards
ADD COLUMN required_approvals INTEGER NOT NULL DEFAULT 1;

-- Enable RLS
ALTER TABLE public.social_approval_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can view approval contacts"
ON public.social_approval_contacts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can manage approval contacts"
ON public.social_approval_contacts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Migrate existing client_phone from social_whatsapp_settings
INSERT INTO public.social_approval_contacts (project_id, phone, name)
SELECT project_id, client_phone, client_name
FROM public.social_whatsapp_settings
WHERE client_phone IS NOT NULL AND client_phone != '';