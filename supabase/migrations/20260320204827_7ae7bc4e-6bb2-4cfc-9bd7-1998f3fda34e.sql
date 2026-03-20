
-- Table for ads briefing form data
CREATE TABLE public.social_ads_briefing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  instagram_url TEXT,
  facebook_url TEXT,
  meta_ads_login TEXT,
  meta_ads_password TEXT,
  monthly_ad_budget NUMERIC,
  payment_method TEXT,
  additional_notes TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.social_ads_briefing ENABLE ROW LEVEL SECURITY;

-- Staff: only consultant assigned to project, admin, master can read
CREATE POLICY "Authorized staff can read ads briefing"
ON public.social_ads_briefing FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND (
      os.role IN ('admin', 'master')
      OR os.id IN (
        SELECT oc.consultant_id FROM public.onboarding_companies oc
        JOIN public.onboarding_projects op ON op.onboarding_company_id = oc.id
        WHERE op.id = social_ads_briefing.project_id
      )
    )
  )
);

-- Staff can insert/update
CREATE POLICY "Authorized staff can insert ads briefing"
ON public.social_ads_briefing FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND (
      os.role IN ('admin', 'master')
      OR os.id IN (
        SELECT oc.consultant_id FROM public.onboarding_companies oc
        JOIN public.onboarding_projects op ON op.onboarding_company_id = oc.id
        WHERE op.id = social_ads_briefing.project_id
      )
    )
  )
);

CREATE POLICY "Authorized staff can update ads briefing"
ON public.social_ads_briefing FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND (
      os.role IN ('admin', 'master')
      OR os.id IN (
        SELECT oc.consultant_id FROM public.onboarding_companies oc
        JOIN public.onboarding_projects op ON op.onboarding_company_id = oc.id
        WHERE op.id = social_ads_briefing.project_id
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND (
      os.role IN ('admin', 'master')
      OR os.id IN (
        SELECT oc.consultant_id FROM public.onboarding_companies oc
        JOIN public.onboarding_projects op ON op.onboarding_company_id = oc.id
        WHERE op.id = social_ads_briefing.project_id
      )
    )
  )
);

-- Public access via token (anon)
CREATE POLICY "Public read ads briefing by token"
ON public.social_ads_briefing FOR SELECT TO anon
USING (access_token IS NOT NULL AND access_token != '');

CREATE POLICY "Public update ads briefing by token"
ON public.social_ads_briefing FOR UPDATE TO anon
USING (access_token IS NOT NULL AND access_token != '')
WITH CHECK (access_token IS NOT NULL AND access_token != '');
