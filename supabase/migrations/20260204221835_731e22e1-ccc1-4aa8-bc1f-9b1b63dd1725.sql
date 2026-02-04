-- =============================================
-- EXTEND SOCIAL BRIEFING STRUCTURE
-- =============================================

-- Add new columns to social_briefing_forms for the extended briefing
ALTER TABLE public.social_briefing_forms
ADD COLUMN IF NOT EXISTS company_since TEXT,
ADD COLUMN IF NOT EXISTS mission_purpose TEXT,
ADD COLUMN IF NOT EXISTS founding_story TEXT,
ADD COLUMN IF NOT EXISTS products_services TEXT,
ADD COLUMN IF NOT EXISTS flagship_products TEXT,
ADD COLUMN IF NOT EXISTS unique_differentiator TEXT,
ADD COLUMN IF NOT EXISTS exclusive_products TEXT,
ADD COLUMN IF NOT EXISTS customer_experience TEXT,
ADD COLUMN IF NOT EXISTS ideal_customer TEXT,
ADD COLUMN IF NOT EXISTS customer_concerns TEXT,
ADD COLUMN IF NOT EXISTS customer_goals TEXT,
ADD COLUMN IF NOT EXISTS brand_perception TEXT,
ADD COLUMN IF NOT EXISTS what_not_to_communicate TEXT,
ADD COLUMN IF NOT EXISTS social_media_objectives TEXT,
ADD COLUMN IF NOT EXISTS non_negotiables TEXT,
ADD COLUMN IF NOT EXISTS profile_gaps TEXT,
ADD COLUMN IF NOT EXISTS reference_profiles TEXT,
ADD COLUMN IF NOT EXISTS direct_competitors TEXT,
ADD COLUMN IF NOT EXISTS instagram_access TEXT,
ADD COLUMN IF NOT EXISTS facebook_access TEXT,
ADD COLUMN IF NOT EXISTS additional_info TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.onboarding_staff(id),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.onboarding_staff(id);

-- Create social_briefing_uploads table for file attachments
CREATE TABLE IF NOT EXISTS public.social_briefing_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_id UUID NOT NULL REFERENCES public.social_briefing_forms(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('logo', 'brand_manual', 'product_catalog', 'other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create social_company_profiles table for executive summary
CREATE TABLE IF NOT EXISTS public.social_company_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE UNIQUE,
  briefing_id UUID REFERENCES public.social_briefing_forms(id),
  brand_identity TEXT,
  positioning TEXT,
  tone_of_voice TEXT,
  communication_rules TEXT,
  official_hashtags TEXT[],
  ai_generated_summary TEXT,
  ai_generated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create social_integrations table for platform connections
CREATE TABLE IF NOT EXISTS public.social_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'whatsapp', 'meta_business')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'requires_action')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  account_id TEXT,
  account_name TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, platform)
);

-- Create social_inspiration_library table
CREATE TABLE IF NOT EXISTS public.social_inspiration_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('instagram_profile', 'reel', 'post', 'image', 'video', 'link')),
  title TEXT,
  description TEXT,
  url TEXT,
  file_url TEXT,
  thumbnail_url TEXT,
  tags TEXT[],
  is_favorite BOOLEAN DEFAULT false,
  added_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create social_audit_logs table for tracking changes
CREATE TABLE IF NOT EXISTS public.social_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'upload', 'approve', 'reject', 'submit')),
  changes JSONB,
  performed_by UUID REFERENCES public.onboarding_staff(id),
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS on new tables
ALTER TABLE public.social_briefing_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_inspiration_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_briefing_uploads
CREATE POLICY "Staff can view briefing uploads" ON public.social_briefing_uploads
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage briefing uploads" ON public.social_briefing_uploads
  FOR ALL USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()));

-- RLS Policies for social_company_profiles
CREATE POLICY "Staff can view company profiles" ON public.social_company_profiles
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage company profiles" ON public.social_company_profiles
  FOR ALL USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()));

-- RLS Policies for social_integrations
CREATE POLICY "Staff can view integrations" ON public.social_integrations
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage integrations" ON public.social_integrations
  FOR ALL USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()));

-- RLS Policies for social_inspiration_library
CREATE POLICY "Staff can view inspiration library" ON public.social_inspiration_library
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage inspiration library" ON public.social_inspiration_library
  FOR ALL USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()));

-- RLS Policies for social_audit_logs
CREATE POLICY "Staff can view audit logs" ON public.social_audit_logs
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()));

CREATE POLICY "Staff can create audit logs" ON public.social_audit_logs
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()));

-- Add briefing_aligned column to social_content_cards
ALTER TABLE public.social_content_cards 
ADD COLUMN IF NOT EXISTS briefing_aligned BOOLEAN DEFAULT false;

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_social_company_profiles_updated_at ON public.social_company_profiles;
CREATE TRIGGER update_social_company_profiles_updated_at
  BEFORE UPDATE ON public.social_company_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_integrations_updated_at ON public.social_integrations;
CREATE TRIGGER update_social_integrations_updated_at
  BEFORE UPDATE ON public.social_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for briefing uploads if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('social-briefing', 'social-briefing', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Staff can upload briefing files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Staff can upload briefing files" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'social-briefing' AND EXISTS (
      SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()
    ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view briefing files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone can view briefing files" ON storage.objects 
    FOR SELECT USING (bucket_id = 'social-briefing');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Staff can delete briefing files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Staff can delete briefing files" ON storage.objects 
    FOR DELETE USING (bucket_id = 'social-briefing' AND EXISTS (
      SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid()
    ));
  END IF;
END $$;