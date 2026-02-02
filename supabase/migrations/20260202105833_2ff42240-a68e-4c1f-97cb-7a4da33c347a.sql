-- Create table for stage checklists (fixed instructions per stage)
CREATE TABLE public.crm_stage_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_stage_checklists ENABLE ROW LEVEL SECURITY;

-- Create policies - same pattern as crm_stage_actions
CREATE POLICY "CRM users can view stage checklists"
  ON public.crm_stage_checklists
  FOR SELECT
  USING (public.has_crm_access());

CREATE POLICY "CRM admins can manage stage checklists"
  ON public.crm_stage_checklists
  FOR ALL
  USING (public.is_crm_admin());

-- Create index for performance
CREATE INDEX idx_crm_stage_checklists_stage_id ON public.crm_stage_checklists(stage_id);

-- Create trigger for updated_at
CREATE TRIGGER update_crm_stage_checklists_updated_at
  BEFORE UPDATE ON public.crm_stage_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();