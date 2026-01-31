-- Add project_id to whatsapp_instances for client isolation
ALTER TABLE public.whatsapp_instances 
ADD COLUMN project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE;

-- Add project_id to whatsapp_campaigns for client isolation  
ALTER TABLE public.whatsapp_campaigns
ADD COLUMN project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_whatsapp_instances_project_id ON public.whatsapp_instances(project_id);
CREATE INDEX idx_whatsapp_campaigns_project_id ON public.whatsapp_campaigns(project_id);

-- RLS for whatsapp_instances - allow staff full access, clients only their project
DROP POLICY IF EXISTS "Staff can manage whatsapp instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Clients can view their project instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Clients can insert their project instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Clients can update their project instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Clients can delete their project instances" ON public.whatsapp_instances;

-- Enable RLS if not already enabled
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Staff (admin/master) can access all instances (global ones without project_id)
CREATE POLICY "Staff can manage all instances" ON public.whatsapp_instances
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role IN ('admin', 'master')
  )
  OR project_id IS NULL
);

-- Clients can access their own project instances
CREATE POLICY "Clients access own project instances" ON public.whatsapp_instances
FOR ALL USING (
  project_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.project_id = whatsapp_instances.project_id
    AND ou.role IN ('client', 'gerente')
  )
)
WITH CHECK (
  project_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.project_id = whatsapp_instances.project_id
    AND ou.role IN ('client', 'gerente')
  )
);

-- RLS for whatsapp_campaigns - similar logic
DROP POLICY IF EXISTS "Staff can manage campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Clients can view their project campaigns" ON public.whatsapp_campaigns;

ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

-- Staff (admin/master) can access all campaigns
CREATE POLICY "Staff manage all campaigns" ON public.whatsapp_campaigns
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role IN ('admin', 'master')
  )
  OR project_id IS NULL
);

-- Clients can access their own project campaigns
CREATE POLICY "Clients access own campaigns" ON public.whatsapp_campaigns
FOR ALL USING (
  project_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.project_id = whatsapp_campaigns.project_id
    AND ou.role IN ('client', 'gerente')
  )
)
WITH CHECK (
  project_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.project_id = whatsapp_campaigns.project_id
    AND ou.role IN ('client', 'gerente')
  )
);