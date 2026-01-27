-- =============================================
-- CIRCLE ADS - Complete Advertising Platform
-- =============================================

-- Enum for campaign objectives
CREATE TYPE public.circle_ads_objective AS ENUM (
  'reach',
  'engagement', 
  'whatsapp_traffic',
  'community_promotion',
  'marketplace_promotion',
  'event_promotion'
);

-- Enum for campaign/ad status
CREATE TYPE public.circle_ads_status AS ENUM (
  'draft',
  'pending_review',
  'active',
  'paused',
  'rejected',
  'completed'
);

-- Enum for budget type
CREATE TYPE public.circle_ads_budget_type AS ENUM (
  'daily',
  'total'
);

-- Enum for ad type
CREATE TYPE public.circle_ads_ad_type AS ENUM (
  'sponsored_post',
  'sponsored_story',
  'marketplace_ad',
  'community_ad',
  'event_ad'
);

-- Enum for CTA type
CREATE TYPE public.circle_ads_cta AS ENUM (
  'whatsapp',
  'view_community',
  'view_listing',
  'learn_more',
  'view_event'
);

-- Enum for placement
CREATE TYPE public.circle_ads_placement AS ENUM (
  'feed',
  'stories',
  'communities',
  'marketplace'
);

-- =============================================
-- 1. WALLETS (User Ad Credits)
-- =============================================
CREATE TABLE public.circle_ads_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.circle_profiles(id) ON DELETE CASCADE,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_deposited DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

-- =============================================
-- 2. WALLET TRANSACTIONS
-- =============================================
CREATE TABLE public.circle_ads_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.circle_ads_wallets(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'spend', 'refund')),
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 3. CAMPAIGNS
-- =============================================
CREATE TABLE public.circle_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.circle_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective circle_ads_objective NOT NULL,
  status circle_ads_status NOT NULL DEFAULT 'draft',
  budget_type circle_ads_budget_type NOT NULL DEFAULT 'daily',
  budget_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  spent_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES public.circle_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 4. AD SETS (Targeting)
-- =============================================
CREATE TABLE public.circle_ads_ad_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.circle_ads_campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status circle_ads_status NOT NULL DEFAULT 'draft',
  
  -- Targeting options (stored as JSONB for flexibility)
  targeting JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Example targeting structure:
  -- {
  --   "companies": ["uuid1", "uuid2"],
  --   "roles": ["gerente", "vendedor"],
  --   "communities": ["uuid1"],
  --   "interests": ["vendas", "marketing"],
  --   "reputation_areas": ["vendas", "gestao"],
  --   "min_trust_score": 50,
  --   "following_profiles": ["uuid1"]
  -- }
  
  -- Placements
  placements circle_ads_placement[] NOT NULL DEFAULT ARRAY['feed']::circle_ads_placement[],
  
  -- Frequency capping
  frequency_cap_impressions INT DEFAULT 3,
  frequency_cap_hours INT DEFAULT 24,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 5. ADS
-- =============================================
CREATE TABLE public.circle_ads_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_set_id UUID NOT NULL REFERENCES public.circle_ads_ad_sets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ad_type circle_ads_ad_type NOT NULL DEFAULT 'sponsored_post',
  status circle_ads_status NOT NULL DEFAULT 'draft',
  
  -- Creative content
  title TEXT,
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- CTA
  cta_type circle_ads_cta NOT NULL DEFAULT 'learn_more',
  cta_url TEXT,
  whatsapp_number TEXT,
  
  -- References (if promoting existing content)
  reference_post_id UUID REFERENCES public.circle_posts(id) ON DELETE SET NULL,
  reference_community_id UUID REFERENCES public.circle_communities(id) ON DELETE SET NULL,
  reference_listing_id UUID REFERENCES public.circle_marketplace_listings(id) ON DELETE SET NULL,
  
  -- Approval
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES public.circle_profiles(id),
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 6. IMPRESSIONS TRACKING
-- =============================================
CREATE TABLE public.circle_ads_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES public.circle_ads_ads(id) ON DELETE CASCADE,
  viewer_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE SET NULL,
  placement circle_ads_placement NOT NULL,
  cost DECIMAL(10,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 7. CLICKS TRACKING
-- =============================================
CREATE TABLE public.circle_ads_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES public.circle_ads_ads(id) ON DELETE CASCADE,
  viewer_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE SET NULL,
  click_type TEXT NOT NULL DEFAULT 'cta', -- 'cta', 'profile', 'content'
  cost DECIMAL(10,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 8. USER REPORTS ON ADS
-- =============================================
CREATE TABLE public.circle_ads_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES public.circle_ads_ads(id) ON DELETE CASCADE,
  reporter_profile_id UUID NOT NULL REFERENCES public.circle_profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ad_id, reporter_profile_id)
);

-- =============================================
-- 9. HIDDEN ADS (User preferences)
-- =============================================
CREATE TABLE public.circle_ads_hidden (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES public.circle_ads_ads(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.circle_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ad_id, profile_id)
);

-- =============================================
-- 10. ADS CONFIG (Admin settings)
-- =============================================
CREATE TABLE public.circle_ads_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_trust_score_to_advertise INT NOT NULL DEFAULT 30,
  cost_per_impression DECIMAL(10,4) NOT NULL DEFAULT 0.01,
  cost_per_click DECIMAL(10,4) NOT NULL DEFAULT 0.10,
  cost_per_engagement DECIMAL(10,4) NOT NULL DEFAULT 0.05,
  min_budget DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  max_budget DECIMAL(10,2) NOT NULL DEFAULT 10000.00,
  max_active_campaigns_per_user INT NOT NULL DEFAULT 5,
  trust_score_discount_threshold INT NOT NULL DEFAULT 70,
  trust_score_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  low_trust_score_penalty_threshold INT NOT NULL DEFAULT 30,
  low_trust_score_penalty_percent DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default config
INSERT INTO public.circle_ads_config (id) VALUES (gen_random_uuid());

-- =============================================
-- 11. DAILY METRICS (Aggregated)
-- =============================================
CREATE TABLE public.circle_ads_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES public.circle_ads_ads(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INT NOT NULL DEFAULT 0,
  unique_reach INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  whatsapp_clicks INT NOT NULL DEFAULT 0,
  spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ad_id, date)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_circle_ads_campaigns_profile ON public.circle_ads_campaigns(profile_id);
CREATE INDEX idx_circle_ads_campaigns_status ON public.circle_ads_campaigns(status);
CREATE INDEX idx_circle_ads_ad_sets_campaign ON public.circle_ads_ad_sets(campaign_id);
CREATE INDEX idx_circle_ads_ads_ad_set ON public.circle_ads_ads(ad_set_id);
CREATE INDEX idx_circle_ads_ads_status ON public.circle_ads_ads(status);
CREATE INDEX idx_circle_ads_impressions_ad ON public.circle_ads_impressions(ad_id);
CREATE INDEX idx_circle_ads_impressions_viewer ON public.circle_ads_impressions(viewer_profile_id);
CREATE INDEX idx_circle_ads_impressions_created ON public.circle_ads_impressions(created_at);
CREATE INDEX idx_circle_ads_clicks_ad ON public.circle_ads_clicks(ad_id);
CREATE INDEX idx_circle_ads_daily_metrics_ad_date ON public.circle_ads_daily_metrics(ad_id, date);

-- =============================================
-- TRIGGERS
-- =============================================
CREATE TRIGGER update_circle_ads_wallets_updated_at
  BEFORE UPDATE ON public.circle_ads_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_circle_ads_campaigns_updated_at
  BEFORE UPDATE ON public.circle_ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_circle_ads_ad_sets_updated_at
  BEFORE UPDATE ON public.circle_ads_ad_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_circle_ads_ads_updated_at
  BEFORE UPDATE ON public.circle_ads_ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_circle_ads_config_updated_at
  BEFORE UPDATE ON public.circle_ads_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FUNCTION: Auto-create wallet for profile
-- =============================================
CREATE OR REPLACE FUNCTION public.ensure_ads_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.circle_ads_wallets (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_ensure_ads_wallet
  AFTER INSERT ON public.circle_profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_ads_wallet();

-- =============================================
-- FUNCTION: Record impression and update metrics
-- =============================================
CREATE OR REPLACE FUNCTION public.record_ad_impression(
  p_ad_id UUID,
  p_viewer_profile_id UUID,
  p_placement circle_ads_placement
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_campaign RECORD;
  v_advertiser_trust_score INT;
  v_cost DECIMAL(10,4);
BEGIN
  -- Get config
  SELECT * INTO v_config FROM public.circle_ads_config LIMIT 1;
  
  -- Get campaign and advertiser info
  SELECT c.*, p.trust_score
  INTO v_campaign
  FROM public.circle_ads_ads a
  JOIN public.circle_ads_ad_sets s ON s.id = a.ad_set_id
  JOIN public.circle_ads_campaigns c ON c.id = s.campaign_id
  JOIN public.circle_profiles p ON p.id = c.profile_id
  WHERE a.id = p_ad_id;
  
  -- Calculate cost based on trust score
  v_cost := v_config.cost_per_impression;
  
  IF v_campaign.trust_score >= v_config.trust_score_discount_threshold THEN
    v_cost := v_cost * (1 - v_config.trust_score_discount_percent / 100);
  ELSIF v_campaign.trust_score <= v_config.low_trust_score_penalty_threshold THEN
    v_cost := v_cost * (1 + v_config.low_trust_score_penalty_percent / 100);
  END IF;
  
  -- Insert impression
  INSERT INTO public.circle_ads_impressions (ad_id, viewer_profile_id, placement, cost)
  VALUES (p_ad_id, p_viewer_profile_id, p_placement, v_cost);
  
  -- Update daily metrics
  INSERT INTO public.circle_ads_daily_metrics (ad_id, date, impressions, spent)
  VALUES (p_ad_id, CURRENT_DATE, 1, v_cost)
  ON CONFLICT (ad_id, date) DO UPDATE
  SET impressions = circle_ads_daily_metrics.impressions + 1,
      spent = circle_ads_daily_metrics.spent + v_cost;
  
  -- Update campaign spent
  UPDATE public.circle_ads_campaigns
  SET spent_amount = spent_amount + v_cost
  WHERE id = v_campaign.id;
  
  -- Deduct from wallet
  UPDATE public.circle_ads_wallets
  SET balance = balance - v_cost,
      total_spent = total_spent + v_cost
  WHERE profile_id = v_campaign.profile_id;
END;
$$;

-- =============================================
-- FUNCTION: Record click
-- =============================================
CREATE OR REPLACE FUNCTION public.record_ad_click(
  p_ad_id UUID,
  p_viewer_profile_id UUID,
  p_click_type TEXT DEFAULT 'cta'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_campaign RECORD;
  v_cost DECIMAL(10,4);
BEGIN
  SELECT * INTO v_config FROM public.circle_ads_config LIMIT 1;
  
  SELECT c.*, p.trust_score
  INTO v_campaign
  FROM public.circle_ads_ads a
  JOIN public.circle_ads_ad_sets s ON s.id = a.ad_set_id
  JOIN public.circle_ads_campaigns c ON c.id = s.campaign_id
  JOIN public.circle_profiles p ON p.id = c.profile_id
  WHERE a.id = p_ad_id;
  
  v_cost := v_config.cost_per_click;
  
  IF v_campaign.trust_score >= v_config.trust_score_discount_threshold THEN
    v_cost := v_cost * (1 - v_config.trust_score_discount_percent / 100);
  ELSIF v_campaign.trust_score <= v_config.low_trust_score_penalty_threshold THEN
    v_cost := v_cost * (1 + v_config.low_trust_score_penalty_percent / 100);
  END IF;
  
  INSERT INTO public.circle_ads_clicks (ad_id, viewer_profile_id, click_type, cost)
  VALUES (p_ad_id, p_viewer_profile_id, p_click_type, v_cost);
  
  INSERT INTO public.circle_ads_daily_metrics (ad_id, date, clicks, spent)
  VALUES (p_ad_id, CURRENT_DATE, 1, v_cost)
  ON CONFLICT (ad_id, date) DO UPDATE
  SET clicks = circle_ads_daily_metrics.clicks + 1,
      spent = circle_ads_daily_metrics.spent + v_cost;
  
  UPDATE public.circle_ads_campaigns
  SET spent_amount = spent_amount + v_cost
  WHERE id = v_campaign.id;
  
  UPDATE public.circle_ads_wallets
  SET balance = balance - v_cost,
      total_spent = total_spent + v_cost
  WHERE profile_id = v_campaign.profile_id;
END;
$$;

-- =============================================
-- FUNCTION: Check if user can advertise
-- =============================================
CREATE OR REPLACE FUNCTION public.can_user_advertise(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_profile RECORD;
  v_active_campaigns INT;
  v_wallet_balance DECIMAL(12,2);
BEGIN
  SELECT * INTO v_config FROM public.circle_ads_config LIMIT 1;
  SELECT * INTO v_profile FROM public.circle_profiles WHERE id = p_profile_id;
  
  SELECT COUNT(*) INTO v_active_campaigns
  FROM public.circle_ads_campaigns
  WHERE profile_id = p_profile_id AND status = 'active';
  
  SELECT COALESCE(balance, 0) INTO v_wallet_balance
  FROM public.circle_ads_wallets
  WHERE profile_id = p_profile_id;
  
  -- Check trust score
  IF v_profile.trust_score < v_config.min_trust_score_to_advertise THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Trust Score insuficiente. Mínimo: ' || v_config.min_trust_score_to_advertise
    );
  END IF;
  
  -- Check active campaigns limit
  IF v_active_campaigns >= v_config.max_active_campaigns_per_user THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Limite de campanhas ativas atingido: ' || v_config.max_active_campaigns_per_user
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'trust_score', v_profile.trust_score,
    'wallet_balance', v_wallet_balance,
    'active_campaigns', v_active_campaigns,
    'max_campaigns', v_config.max_active_campaigns_per_user
  );
END;
$$;

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE public.circle_ads_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_hidden ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_daily_metrics ENABLE ROW LEVEL SECURITY;

-- Wallets: Users can view their own
CREATE POLICY "Users can view own wallet" ON public.circle_ads_wallets
  FOR SELECT USING (profile_id = public.get_circle_profile_id_safe());

-- Transactions: Users can view their own
CREATE POLICY "Users can view own transactions" ON public.circle_ads_transactions
  FOR SELECT USING (
    wallet_id IN (SELECT id FROM public.circle_ads_wallets WHERE profile_id = public.get_circle_profile_id_safe())
  );

-- Campaigns: Full CRUD for owners, view for admins
CREATE POLICY "Users can manage own campaigns" ON public.circle_ads_campaigns
  FOR ALL USING (profile_id = public.get_circle_profile_id_safe());

CREATE POLICY "Admins can view all campaigns" ON public.circle_ads_campaigns
  FOR SELECT USING (public.is_onboarding_admin());

CREATE POLICY "Admins can update campaigns" ON public.circle_ads_campaigns
  FOR UPDATE USING (public.is_onboarding_admin());

-- Ad Sets: Owners can manage
CREATE POLICY "Users can manage own ad sets" ON public.circle_ads_ad_sets
  FOR ALL USING (
    campaign_id IN (SELECT id FROM public.circle_ads_campaigns WHERE profile_id = public.get_circle_profile_id_safe())
  );

CREATE POLICY "Admins can view all ad sets" ON public.circle_ads_ad_sets
  FOR SELECT USING (public.is_onboarding_admin());

-- Ads: Owners can manage
CREATE POLICY "Users can manage own ads" ON public.circle_ads_ads
  FOR ALL USING (
    ad_set_id IN (
      SELECT s.id FROM public.circle_ads_ad_sets s
      JOIN public.circle_ads_campaigns c ON c.id = s.campaign_id
      WHERE c.profile_id = public.get_circle_profile_id_safe()
    )
  );

CREATE POLICY "Admins can manage all ads" ON public.circle_ads_ads
  FOR ALL USING (public.is_onboarding_admin());

CREATE POLICY "Active ads are viewable" ON public.circle_ads_ads
  FOR SELECT USING (status = 'active');

-- Impressions: Insert via function, view own
CREATE POLICY "Users can view impressions on own ads" ON public.circle_ads_impressions
  FOR SELECT USING (
    ad_id IN (
      SELECT a.id FROM public.circle_ads_ads a
      JOIN public.circle_ads_ad_sets s ON s.id = a.ad_set_id
      JOIN public.circle_ads_campaigns c ON c.id = s.campaign_id
      WHERE c.profile_id = public.get_circle_profile_id_safe()
    )
  );

-- Clicks: Similar to impressions
CREATE POLICY "Users can view clicks on own ads" ON public.circle_ads_clicks
  FOR SELECT USING (
    ad_id IN (
      SELECT a.id FROM public.circle_ads_ads a
      JOIN public.circle_ads_ad_sets s ON s.id = a.ad_set_id
      JOIN public.circle_ads_campaigns c ON c.id = s.campaign_id
      WHERE c.profile_id = public.get_circle_profile_id_safe()
    )
  );

-- Reports: Users can report, admins can view all
CREATE POLICY "Users can report ads" ON public.circle_ads_reports
  FOR INSERT WITH CHECK (reporter_profile_id = public.get_circle_profile_id_safe());

CREATE POLICY "Admins can view reports" ON public.circle_ads_reports
  FOR SELECT USING (public.is_onboarding_admin());

-- Hidden: Users manage their own
CREATE POLICY "Users can manage hidden ads" ON public.circle_ads_hidden
  FOR ALL USING (profile_id = public.get_circle_profile_id_safe());

-- Config: Admins only
CREATE POLICY "Admins can manage config" ON public.circle_ads_config
  FOR ALL USING (public.is_onboarding_admin());

CREATE POLICY "Anyone can view config" ON public.circle_ads_config
  FOR SELECT USING (true);

-- Daily Metrics: Owners and admins
CREATE POLICY "Users can view own metrics" ON public.circle_ads_daily_metrics
  FOR SELECT USING (
    ad_id IN (
      SELECT a.id FROM public.circle_ads_ads a
      JOIN public.circle_ads_ad_sets s ON s.id = a.ad_set_id
      JOIN public.circle_ads_campaigns c ON c.id = s.campaign_id
      WHERE c.profile_id = public.get_circle_profile_id_safe()
    )
  );

CREATE POLICY "Admins can view all metrics" ON public.circle_ads_daily_metrics
  FOR SELECT USING (public.is_onboarding_admin());