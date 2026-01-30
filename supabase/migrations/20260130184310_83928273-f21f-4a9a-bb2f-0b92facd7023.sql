-- Create table for WhatsApp instance access permissions
CREATE TABLE public.whatsapp_instance_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT true,
    can_send BOOLEAN DEFAULT true,
    granted_by UUID REFERENCES public.onboarding_staff(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(instance_id, staff_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_instance_access ENABLE ROW LEVEL SECURITY;

-- Policy: Master and admins can manage all access
CREATE POLICY "Master and admins can manage instance access"
ON public.whatsapp_instance_access
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.onboarding_staff
        WHERE user_id = auth.uid()
        AND role IN ('master', 'admin')
    )
);

-- Policy: Staff can view their own access
CREATE POLICY "Staff can view their own access"
ON public.whatsapp_instance_access
FOR SELECT
USING (
    staff_id IN (
        SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid()
    )
);

-- Create function to check instance access (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_whatsapp_instance_access(_staff_id UUID, _instance_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        -- Master always has access
        SELECT 1 FROM public.onboarding_staff
        WHERE id = _staff_id AND role = 'master'
    ) OR EXISTS (
        -- Explicit access granted
        SELECT 1 FROM public.whatsapp_instance_access
        WHERE staff_id = _staff_id 
        AND instance_id = _instance_id
        AND can_view = true
    )
$$;

-- Add index for performance
CREATE INDEX idx_whatsapp_instance_access_staff ON public.whatsapp_instance_access(staff_id);
CREATE INDEX idx_whatsapp_instance_access_instance ON public.whatsapp_instance_access(instance_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_instance_access;