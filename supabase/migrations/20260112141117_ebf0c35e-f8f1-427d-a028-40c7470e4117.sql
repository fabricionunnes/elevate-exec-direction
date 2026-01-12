-- Create whatsapp_instances table
CREATE TABLE public.whatsapp_instances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  phone_number TEXT,
  status TEXT DEFAULT 'disconnected',
  qr_code TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create whatsapp_message_log table
CREATE TABLE public.whatsapp_message_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  status TEXT DEFAULT 'sent',
  company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE SET NULL,
  sent_by UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_instances
CREATE POLICY "Staff can view instances" 
ON public.whatsapp_instances 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins can insert instances" 
ON public.whatsapp_instances 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can update instances" 
ON public.whatsapp_instances 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can delete instances" 
ON public.whatsapp_instances 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND role = 'admin')
);

-- RLS Policies for whatsapp_message_log
CREATE POLICY "Staff can view message logs" 
ON public.whatsapp_message_log 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Staff can insert message logs" 
ON public.whatsapp_message_log 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid())
);

-- Create updated_at trigger for whatsapp_instances
CREATE TRIGGER update_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_instances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_message_log;