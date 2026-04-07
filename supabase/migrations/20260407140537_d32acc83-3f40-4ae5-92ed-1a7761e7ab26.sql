-- Add project_id column to crm_whatsapp_conversations
ALTER TABLE public.crm_whatsapp_conversations
ADD COLUMN project_id uuid REFERENCES public.onboarding_projects(id) ON DELETE SET NULL;

-- Index for fast filtering by project
CREATE INDEX idx_crm_whatsapp_conversations_project_id ON public.crm_whatsapp_conversations(project_id) WHERE project_id IS NOT NULL;