
-- Meta Ads account connections per project
CREATE TABLE public.meta_ads_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  connected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, ad_account_id)
);

ALTER TABLE public.meta_ads_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and project members can view meta ads accounts"
  ON public.meta_ads_accounts FOR SELECT TO authenticated
  USING (public.is_onboarding_project_member(project_id));

CREATE POLICY "Staff can manage meta ads accounts"
  ON public.meta_ads_accounts FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Cached campaign data
CREATE TABLE public.meta_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  status TEXT,
  objective TEXT,
  daily_budget NUMERIC,
  lifetime_budget NUMERIC,
  impressions BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend NUMERIC(12,2) DEFAULT 0,
  cpc NUMERIC(10,4) DEFAULT 0,
  cpm NUMERIC(10,4) DEFAULT 0,
  ctr NUMERIC(10,4) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value NUMERIC(12,2) DEFAULT 0,
  roas NUMERIC(10,4) DEFAULT 0,
  frequency NUMERIC(10,4) DEFAULT 0,
  date_start DATE,
  date_stop DATE,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, campaign_id, date_start, date_stop)
);

ALTER TABLE public.meta_ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view meta ads campaigns"
  ON public.meta_ads_campaigns FOR SELECT TO authenticated
  USING (public.is_onboarding_project_member(project_id));

CREATE POLICY "Service role can manage meta ads campaigns"
  ON public.meta_ads_campaigns FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Cached adset data
CREATE TABLE public.meta_ads_adsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  adset_id TEXT NOT NULL,
  adset_name TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  status TEXT,
  daily_budget NUMERIC,
  impressions BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend NUMERIC(12,2) DEFAULT 0,
  cpc NUMERIC(10,4) DEFAULT 0,
  cpm NUMERIC(10,4) DEFAULT 0,
  ctr NUMERIC(10,4) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value NUMERIC(12,2) DEFAULT 0,
  roas NUMERIC(10,4) DEFAULT 0,
  frequency NUMERIC(10,4) DEFAULT 0,
  date_start DATE,
  date_stop DATE,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, adset_id, date_start, date_stop)
);

ALTER TABLE public.meta_ads_adsets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view meta ads adsets"
  ON public.meta_ads_adsets FOR SELECT TO authenticated
  USING (public.is_onboarding_project_member(project_id));

CREATE POLICY "Service role can manage meta ads adsets"
  ON public.meta_ads_adsets FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Cached ads (creatives) data
CREATE TABLE public.meta_ads_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  status TEXT,
  creative_thumbnail_url TEXT,
  creative_body TEXT,
  creative_title TEXT,
  creative_link_url TEXT,
  impressions BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend NUMERIC(12,2) DEFAULT 0,
  cpc NUMERIC(10,4) DEFAULT 0,
  cpm NUMERIC(10,4) DEFAULT 0,
  ctr NUMERIC(10,4) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value NUMERIC(12,2) DEFAULT 0,
  roas NUMERIC(10,4) DEFAULT 0,
  frequency NUMERIC(10,4) DEFAULT 0,
  date_start DATE,
  date_stop DATE,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, ad_id, date_start, date_stop)
);

ALTER TABLE public.meta_ads_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view meta ads"
  ON public.meta_ads_ads FOR SELECT TO authenticated
  USING (public.is_onboarding_project_member(project_id));

CREATE POLICY "Service role can manage meta ads"
  ON public.meta_ads_ads FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
