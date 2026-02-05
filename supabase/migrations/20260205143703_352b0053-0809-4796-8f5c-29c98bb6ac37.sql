-- Create social_instagram_accounts table if not exists
CREATE TABLE IF NOT EXISTS public.social_instagram_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  instagram_user_id TEXT,
  instagram_username TEXT,
  profile_picture_url TEXT,
  followers_count INTEGER,
  facebook_page_id TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_instagram_accounts_project_unique UNIQUE (project_id)
);

-- Enable RLS
ALTER TABLE public.social_instagram_accounts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Staff can view instagram accounts"
ON public.social_instagram_accounts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Staff can insert instagram accounts"
ON public.social_instagram_accounts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Staff can update instagram accounts"
ON public.social_instagram_accounts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Update timestamp trigger
CREATE TRIGGER update_social_instagram_accounts_updated_at
BEFORE UPDATE ON public.social_instagram_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();