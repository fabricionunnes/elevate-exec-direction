-- Create table to store client Evolution API credentials per project
CREATE TABLE public.client_evolution_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_project_evolution_config UNIQUE (project_id)
);

-- Enable RLS
ALTER TABLE public.client_evolution_config ENABLE ROW LEVEL SECURITY;

-- Policy: Clients can view/manage their own project's config
CREATE POLICY "Clients manage own project evolution config"
ON public.client_evolution_config
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.project_id = client_evolution_config.project_id
    AND ou.role IN ('client', 'gerente')
  )
);

-- Policy: Staff can view all configs
CREATE POLICY "Staff view all evolution configs"
ON public.client_evolution_config
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_client_evolution_config_updated_at
BEFORE UPDATE ON public.client_evolution_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();