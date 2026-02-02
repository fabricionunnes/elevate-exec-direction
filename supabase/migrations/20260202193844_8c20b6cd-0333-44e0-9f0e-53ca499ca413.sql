-- Create table for saved contact/group lists
CREATE TABLE public.whatsapp_saved_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  list_type TEXT NOT NULL CHECK (list_type IN ('contacts', 'groups')),
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  item_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_saved_lists ENABLE ROW LEVEL SECURITY;

-- Policy: Users with instance access can view lists
CREATE POLICY "Users with instance access can view lists"
ON public.whatsapp_saved_lists
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_instance_access wia
    WHERE wia.instance_id = whatsapp_saved_lists.instance_id
    AND wia.staff_id = public.get_current_staff_id()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role = 'master'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    JOIN public.whatsapp_instances wi ON wi.project_id = ou.project_id
    WHERE ou.user_id = auth.uid()
    AND wi.id = whatsapp_saved_lists.instance_id
  )
);

-- Policy: Users with instance access can create lists
CREATE POLICY "Users with instance access can create lists"
ON public.whatsapp_saved_lists
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.whatsapp_instance_access wia
    WHERE wia.instance_id = whatsapp_saved_lists.instance_id
    AND wia.staff_id = public.get_current_staff_id()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role = 'master'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    JOIN public.whatsapp_instances wi ON wi.project_id = ou.project_id
    WHERE ou.user_id = auth.uid()
    AND wi.id = whatsapp_saved_lists.instance_id
  )
);

-- Policy: Users with instance access can update lists
CREATE POLICY "Users with instance access can update lists"
ON public.whatsapp_saved_lists
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_instance_access wia
    WHERE wia.instance_id = whatsapp_saved_lists.instance_id
    AND wia.staff_id = public.get_current_staff_id()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role = 'master'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    JOIN public.whatsapp_instances wi ON wi.project_id = ou.project_id
    WHERE ou.user_id = auth.uid()
    AND wi.id = whatsapp_saved_lists.instance_id
  )
);

-- Policy: Users with instance access can delete lists
CREATE POLICY "Users with instance access can delete lists"
ON public.whatsapp_saved_lists
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_instance_access wia
    WHERE wia.instance_id = whatsapp_saved_lists.instance_id
    AND wia.staff_id = public.get_current_staff_id()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role = 'master'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    JOIN public.whatsapp_instances wi ON wi.project_id = ou.project_id
    WHERE ou.user_id = auth.uid()
    AND wi.id = whatsapp_saved_lists.instance_id
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_saved_lists_updated_at
BEFORE UPDATE ON public.whatsapp_saved_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_whatsapp_saved_lists_instance ON public.whatsapp_saved_lists(instance_id);
CREATE INDEX idx_whatsapp_saved_lists_type ON public.whatsapp_saved_lists(list_type);