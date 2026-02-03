-- Create access control table for Official WhatsApp API instances
CREATE TABLE public.whatsapp_official_instance_access (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
    instance_id UUID NOT NULL REFERENCES public.whatsapp_official_instances(id) ON DELETE CASCADE,
    can_view BOOLEAN NOT NULL DEFAULT true,
    can_send BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(staff_id, instance_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_official_instance_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view their own access"
ON public.whatsapp_official_instance_access
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage access"
ON public.whatsapp_official_instance_access
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.onboarding_staff
        WHERE user_id = auth.uid()
        AND role IN ('master', 'admin')
    )
);

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_official_instance_access;