-- Create service sectors table for organizing support teams
CREATE TABLE public.crm_service_sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'star',
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add sector to whatsapp_instances
ALTER TABLE public.whatsapp_instances
ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES public.crm_service_sectors(id) ON DELETE SET NULL;

-- Create table to link staff to whatsapp instances (for permissions)
CREATE TABLE public.crm_service_staff_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, instance_id)
);

-- Create quick responses table
CREATE TABLE public.crm_quick_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  shortcut TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create scheduled messages table
CREATE TABLE public.crm_scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create staff service permissions table
CREATE TABLE public.crm_service_staff_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  is_allowed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, permission_key)
);

-- Create service notifications settings
CREATE TABLE public.crm_service_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  notify_new_message BOOLEAN DEFAULT true,
  notify_new_lead BOOLEAN DEFAULT true,
  notify_assignment BOOLEAN DEFAULT true,
  notify_sound BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id)
);

-- Enable RLS
ALTER TABLE public.crm_service_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_service_staff_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_quick_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_service_staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_service_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow authenticated users to read
CREATE POLICY "Authenticated users can read sectors" ON public.crm_service_sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read staff devices" ON public.crm_service_staff_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read quick responses" ON public.crm_quick_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read scheduled messages" ON public.crm_scheduled_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read permissions" ON public.crm_service_staff_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read notifications" ON public.crm_service_notifications FOR SELECT TO authenticated USING (true);

-- RLS Policies - Allow authenticated users to manage (for admins, will be controlled at app level)
CREATE POLICY "Authenticated users can manage sectors" ON public.crm_service_sectors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage staff devices" ON public.crm_service_staff_devices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage quick responses" ON public.crm_quick_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage scheduled messages" ON public.crm_scheduled_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage permissions" ON public.crm_service_staff_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage notifications" ON public.crm_service_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add link table for staff to sectors
CREATE TABLE public.crm_service_sector_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sector_id UUID NOT NULL REFERENCES public.crm_service_sectors(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sector_id, staff_id)
);

ALTER TABLE public.crm_service_sector_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sector staff" ON public.crm_service_sector_staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage sector staff" ON public.crm_service_sector_staff FOR ALL TO authenticated USING (true) WITH CHECK (true);