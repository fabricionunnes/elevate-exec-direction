-- =============================================
-- CIRCLE ADS 2.0 - Complete Media Platform
-- =============================================

-- 1) ENUMS for new features
CREATE TYPE public.circle_ads_package_tier AS ENUM ('starter', 'growth', 'scale', 'enterprise');
CREATE TYPE public.circle_ads_auction_status AS ENUM ('pending', 'running', 'completed', 'cancelled');
CREATE TYPE public.circle_pixel_event_type AS ENUM (
  'page_view', 'social_view', 'social_like', 'social_comment', 'social_share', 'story_view',
  'community_join', 'community_post', 'marketplace_view', 'marketplace_click', 'marketplace_whatsapp',
  'academy_lesson', 'academy_quiz', 'academy_track', 'ad_impression', 'ad_click', 'ad_conversion'
);
CREATE TYPE public.circle_audience_rule_operator AS ENUM ('AND', 'OR');
CREATE TYPE public.circle_privacy_consent AS ENUM ('personalized', 'generic_only', 'opt_out');

-- 2) CIRCLE PIXEL EVENTS - First-party tracking
CREATE TABLE public.circle_pixel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  event_type circle_pixel_event_type NOT NULL,
  event_data JSONB DEFAULT '{}',
  reference_id UUID,
  reference_type TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pixel_events_profile ON public.circle_pixel_events(profile_id);
CREATE INDEX idx_pixel_events_type ON public.circle_pixel_events(event_type);
CREATE INDEX idx_pixel_events_created ON public.circle_pixel_events(created_at);

-- 3) AUDIENCES - Advanced segmentation
CREATE TABLE public.circle_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '[]',
  rule_operator circle_audience_rule_operator DEFAULT 'AND',
  time_window_days INTEGER DEFAULT 30,
  exclusion_audience_ids UUID[] DEFAULT '{}',
  is_lookalike BOOLEAN DEFAULT false,
  source_audience_id UUID REFERENCES public.circle_audiences(id),
  estimated_size INTEGER DEFAULT 0,
  engagement_score NUMERIC(5,2) DEFAULT 0,
  conversion_rate NUMERIC(5,4) DEFAULT 0,
  avg_trust_score NUMERIC(5,2) DEFAULT 0,
  value_score NUMERIC(5,2) DEFAULT 0,
  is_template BOOLEAN DEFAULT false,
  template_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audiences_profile ON public.circle_audiences(profile_id);

-- 4) AUDIENCE MEMBERS - Cached audience membership
CREATE TABLE public.circle_audience_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id UUID REFERENCES public.circle_audiences(id) ON DELETE CASCADE NOT NULL,
  member_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  match_score NUMERIC(5,2) DEFAULT 100,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(audience_id, member_profile_id)
);

-- 5) MEDIA PACKAGES
CREATE TABLE public.circle_ads_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier circle_ads_package_tier NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  max_campaigns INTEGER NOT NULL DEFAULT 1,
  max_audiences INTEGER NOT NULL DEFAULT 1,
  ai_access BOOLEAN DEFAULT false,
  priority_boost NUMERIC(3,2) DEFAULT 1.0,
  advanced_reports BOOLEAN DEFAULT false,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  features JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default packages
INSERT INTO public.circle_ads_packages (tier, name, description, monthly_credits, max_campaigns, max_audiences, ai_access, priority_boost, advanced_reports, price_monthly, features) VALUES
('starter', 'Starter', 'Ideal para começar a anunciar', 500, 2, 3, false, 1.0, false, 99.00, '["2 campanhas ativas", "3 públicos salvos", "Relatórios básicos"]'),
('growth', 'Growth', 'Para negócios em crescimento', 2000, 5, 10, true, 1.2, false, 299.00, '["5 campanhas ativas", "10 públicos salvos", "Circle Ads AI básico", "Prioridade 20% maior"]'),
('scale', 'Scale', 'Escale seus resultados', 5000, 15, 25, true, 1.5, true, 599.00, '["15 campanhas ativas", "25 públicos salvos", "Circle Ads AI completo", "Prioridade 50% maior", "Relatórios avançados"]'),
('enterprise', 'Enterprise', 'Para grandes anunciantes', 15000, -1, -1, true, 2.0, true, 1499.00, '["Campanhas ilimitadas", "Públicos ilimitados", "Circle Ads AI premium", "Prioridade máxima", "Suporte dedicado"]');

-- 6) USER PACKAGE SUBSCRIPTIONS
CREATE TABLE public.circle_ads_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  package_id UUID REFERENCES public.circle_ads_packages(id) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  renewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

-- 7) CREDITS LEDGER
CREATE TABLE public.circle_ads_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('credit', 'debit', 'expire', 'bonus', 'refund')),
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8) PRICING RULES - Dynamic pricing based on Trust Score
CREATE TABLE public.circle_ads_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  min_trust_score INTEGER NOT NULL DEFAULT 0,
  max_trust_score INTEGER NOT NULL DEFAULT 100,
  cpm_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  cpc_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  reach_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  priority_boost NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default pricing rules
INSERT INTO public.circle_ads_pricing_rules (name, min_trust_score, max_trust_score, cpm_multiplier, cpc_multiplier, reach_multiplier, priority_boost) VALUES
('Trust Elite', 80, 100, 0.7, 0.7, 1.5, 1.5),
('Trust Alto', 60, 79, 0.85, 0.85, 1.2, 1.2),
('Trust Médio', 40, 59, 1.0, 1.0, 1.0, 1.0),
('Trust Baixo', 20, 39, 1.3, 1.3, 0.8, 0.8),
('Trust Crítico', 0, 19, 1.8, 1.8, 0.5, 0.5);

-- 9) AUCTIONS - Internal ad auction system
CREATE TABLE public.circle_ads_auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement TEXT NOT NULL,
  target_profile_id UUID REFERENCES public.circle_profiles(id),
  audience_id UUID REFERENCES public.circle_audiences(id),
  status circle_ads_auction_status DEFAULT 'pending',
  winning_ad_id UUID,
  winning_bid_id UUID,
  total_bids INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10) BIDS - Individual bids in auctions
CREATE TABLE public.circle_ads_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID REFERENCES public.circle_ads_auctions(id) ON DELETE CASCADE NOT NULL,
  ad_id UUID REFERENCES public.circle_ads_ads(id) ON DELETE CASCADE NOT NULL,
  advertiser_profile_id UUID REFERENCES public.circle_profiles(id) NOT NULL,
  bid_amount NUMERIC(10,4) NOT NULL,
  trust_score INTEGER NOT NULL DEFAULT 50,
  quality_score NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  relevance_score NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  final_score NUMERIC(10,4) NOT NULL,
  is_winner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bids_auction ON public.circle_ads_bids(auction_id);
CREATE INDEX idx_bids_ad ON public.circle_ads_bids(ad_id);

-- 11) AI CAMPAIGN REQUESTS
CREATE TABLE public.circle_ads_ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  objective TEXT NOT NULL CHECK (objective IN ('sell', 'whatsapp_leads', 'community', 'event', 'brand_awareness')),
  context_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12) AI CAMPAIGN RESULTS
CREATE TABLE public.circle_ads_ai_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.circle_ads_ai_requests(id) ON DELETE CASCADE NOT NULL,
  campaign_suggestion JSONB NOT NULL,
  ad_set_suggestion JSONB NOT NULL,
  ad_suggestion JSONB NOT NULL,
  audience_suggestion JSONB,
  budget_suggestion JSONB,
  confidence_score NUMERIC(5,2) DEFAULT 0,
  accepted BOOLEAN,
  campaign_id UUID REFERENCES public.circle_ads_campaigns(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13) PRIVACY SETTINGS - LGPD compliance
CREATE TABLE public.circle_ads_privacy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  consent circle_privacy_consent DEFAULT 'personalized',
  consent_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_collection_consent BOOLEAN DEFAULT true,
  personalized_ads_consent BOOLEAN DEFAULT true,
  third_party_sharing BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14) AD QUALITY SCORES - Track ad performance for auction
CREATE TABLE public.circle_ads_quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID REFERENCES public.circle_ads_ads(id) ON DELETE CASCADE NOT NULL UNIQUE,
  ctr NUMERIC(5,4) DEFAULT 0,
  engagement_rate NUMERIC(5,4) DEFAULT 0,
  report_rate NUMERIC(5,4) DEFAULT 0,
  hide_rate NUMERIC(5,4) DEFAULT 0,
  quality_score NUMERIC(5,2) DEFAULT 5.0,
  relevance_score NUMERIC(5,2) DEFAULT 5.0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15) AUCTION HISTORY - For transparency
CREATE TABLE public.circle_ads_auction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  auction_id UUID REFERENCES public.circle_ads_auctions(id) ON DELETE CASCADE NOT NULL,
  ad_id UUID REFERENCES public.circle_ads_ads(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('won', 'lost', 'no_bid')),
  bid_amount NUMERIC(10,4),
  final_score NUMERIC(10,4),
  competitor_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Calculate ad quality score
CREATE OR REPLACE FUNCTION public.calculate_ad_quality_score(p_ad_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_impressions BIGINT;
  v_clicks BIGINT;
  v_reports BIGINT;
  v_hides BIGINT;
  v_ctr NUMERIC;
  v_report_rate NUMERIC;
  v_hide_rate NUMERIC;
  v_quality NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_impressions FROM public.circle_ads_impressions WHERE ad_id = p_ad_id;
  SELECT COUNT(*) INTO v_clicks FROM public.circle_ads_clicks WHERE ad_id = p_ad_id;
  SELECT COUNT(*) INTO v_reports FROM public.circle_ads_reports WHERE ad_id = p_ad_id;
  SELECT COUNT(*) INTO v_hides FROM public.circle_ads_hidden WHERE ad_id = p_ad_id;

  IF v_impressions = 0 THEN
    RETURN 5.0;
  END IF;

  v_ctr := v_clicks::NUMERIC / v_impressions;
  v_report_rate := v_reports::NUMERIC / v_impressions;
  v_hide_rate := v_hides::NUMERIC / v_impressions;

  -- Quality formula: base 5 + CTR bonus - penalties
  v_quality := 5.0 + (v_ctr * 50) - (v_report_rate * 100) - (v_hide_rate * 20);
  v_quality := GREATEST(1.0, LEAST(10.0, v_quality));

  -- Update quality scores table
  INSERT INTO public.circle_ads_quality_scores (ad_id, ctr, report_rate, hide_rate, quality_score)
  VALUES (p_ad_id, v_ctr, v_report_rate, v_hide_rate, v_quality)
  ON CONFLICT (ad_id) DO UPDATE SET
    ctr = v_ctr,
    report_rate = v_report_rate,
    hide_rate = v_hide_rate,
    quality_score = v_quality,
    updated_at = now();

  RETURN v_quality;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get pricing multiplier for a trust score
CREATE OR REPLACE FUNCTION public.get_ads_pricing_multiplier(p_trust_score INTEGER)
RETURNS TABLE(cpm_mult NUMERIC, cpc_mult NUMERIC, reach_mult NUMERIC, priority_mult NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT cpm_multiplier, cpc_multiplier, reach_multiplier, priority_boost
  FROM public.circle_ads_pricing_rules
  WHERE p_trust_score >= min_trust_score AND p_trust_score <= max_trust_score AND is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 1.0::NUMERIC, 1.0::NUMERIC, 1.0::NUMERIC, 1.0::NUMERIC;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Run auction for a placement
CREATE OR REPLACE FUNCTION public.run_ads_auction(
  p_placement TEXT,
  p_target_profile_id UUID DEFAULT NULL,
  p_audience_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_auction_id UUID;
  v_winning_bid RECORD;
  v_ad RECORD;
  v_trust_score INTEGER;
  v_quality_score NUMERIC;
  v_final_score NUMERIC;
  v_pricing RECORD;
BEGIN
  -- Create auction
  INSERT INTO public.circle_ads_auctions (placement, target_profile_id, audience_id, status, started_at)
  VALUES (p_placement, p_target_profile_id, p_audience_id, 'running', now())
  RETURNING id INTO v_auction_id;

  -- Get all eligible ads
  FOR v_ad IN
    SELECT a.*, s.profile_id as advertiser_id, c.daily_budget, c.total_budget
    FROM public.circle_ads_ads a
    JOIN public.circle_ads_ad_sets s ON s.id = a.ad_set_id
    JOIN public.circle_ads_campaigns c ON c.id = s.campaign_id
    WHERE a.status = 'approved'
      AND c.status = 'active'
      AND s.status = 'active'
      AND p_placement = ANY(s.placements)
  LOOP
    -- Get advertiser trust score
    SELECT COALESCE(trust_score, 50) INTO v_trust_score
    FROM public.circle_profiles WHERE id = v_ad.advertiser_id;

    -- Get quality score
    v_quality_score := public.calculate_ad_quality_score(v_ad.id);

    -- Get pricing multiplier
    SELECT * INTO v_pricing FROM public.get_ads_pricing_multiplier(v_trust_score);

    -- Calculate final score: bid × quality × trust × package priority
    v_final_score := (COALESCE(v_ad.bid_amount, 0.01) * v_quality_score * (v_trust_score::NUMERIC / 50) * COALESCE(v_pricing.priority_mult, 1.0));

    -- Insert bid
    INSERT INTO public.circle_ads_bids (
      auction_id, ad_id, advertiser_profile_id, bid_amount,
      trust_score, quality_score, relevance_score, final_score
    ) VALUES (
      v_auction_id, v_ad.id, v_ad.advertiser_id, COALESCE(v_ad.bid_amount, 0.01),
      v_trust_score, v_quality_score, 1.0, v_final_score
    );
  END LOOP;

  -- Determine winner
  SELECT * INTO v_winning_bid
  FROM public.circle_ads_bids
  WHERE auction_id = v_auction_id
  ORDER BY final_score DESC
  LIMIT 1;

  IF v_winning_bid.id IS NOT NULL THEN
    -- Mark winner
    UPDATE public.circle_ads_bids SET is_winner = true WHERE id = v_winning_bid.id;
    
    -- Update auction
    UPDATE public.circle_ads_auctions 
    SET status = 'completed', 
        winning_ad_id = v_winning_bid.ad_id,
        winning_bid_id = v_winning_bid.id,
        total_bids = (SELECT COUNT(*) FROM public.circle_ads_bids WHERE auction_id = v_auction_id),
        completed_at = now()
    WHERE id = v_auction_id;

    -- Record history for all participants
    INSERT INTO public.circle_ads_auction_history (profile_id, auction_id, ad_id, result, bid_amount, final_score, competitor_count)
    SELECT 
      b.advertiser_profile_id,
      v_auction_id,
      b.ad_id,
      CASE WHEN b.is_winner THEN 'won' ELSE 'lost' END,
      b.bid_amount,
      b.final_score,
      (SELECT COUNT(*) - 1 FROM public.circle_ads_bids WHERE auction_id = v_auction_id)
    FROM public.circle_ads_bids b
    WHERE b.auction_id = v_auction_id;
  ELSE
    UPDATE public.circle_ads_auctions SET status = 'completed', completed_at = now() WHERE id = v_auction_id;
  END IF;

  RETURN v_auction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Track pixel event
CREATE OR REPLACE FUNCTION public.track_circle_pixel_event(
  p_event_type circle_pixel_event_type,
  p_event_data JSONB DEFAULT '{}',
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_profile_id UUID;
  v_privacy RECORD;
  v_event_id UUID;
BEGIN
  v_profile_id := public.get_circle_profile_id_safe();
  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check privacy consent
  SELECT * INTO v_privacy FROM public.circle_ads_privacy WHERE profile_id = v_profile_id;
  IF v_privacy.consent = 'opt_out' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.circle_pixel_events (profile_id, event_type, event_data, reference_id, reference_type, session_id)
  VALUES (v_profile_id, p_event_type, p_event_data, p_reference_id, p_reference_type, p_session_id)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get user credits balance
CREATE OR REPLACE FUNCTION public.get_ads_credits_balance(p_profile_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(
    CASE WHEN operation IN ('credit', 'bonus', 'refund') THEN amount ELSE -amount END
  ), 0)
  INTO v_balance
  FROM public.circle_ads_credits
  WHERE profile_id = p_profile_id
    AND (expires_at IS NULL OR expires_at > now());
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.circle_pixel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_audience_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_ai_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_privacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_ads_auction_history ENABLE ROW LEVEL SECURITY;

-- Pixel events - users can only insert their own, admins can read all
CREATE POLICY "Users can insert own pixel events" ON public.circle_pixel_events FOR INSERT WITH CHECK (profile_id = public.get_circle_profile_id_safe());
CREATE POLICY "Users can read own pixel events" ON public.circle_pixel_events FOR SELECT USING (profile_id = public.get_circle_profile_id_safe() OR public.is_onboarding_admin());

-- Audiences
CREATE POLICY "Users can manage own audiences" ON public.circle_audiences FOR ALL USING (profile_id = public.get_circle_profile_id_safe());
CREATE POLICY "View template audiences" ON public.circle_audiences FOR SELECT USING (is_template = true);

-- Audience members - read only for owners
CREATE POLICY "Audience owners can view members" ON public.circle_audience_members FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.circle_audiences a WHERE a.id = audience_id AND a.profile_id = public.get_circle_profile_id_safe()));

-- Packages - public read
CREATE POLICY "Anyone can view packages" ON public.circle_ads_packages FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage packages" ON public.circle_ads_packages FOR ALL USING (public.is_onboarding_admin());

-- Subscriptions
CREATE POLICY "Users can view own subscription" ON public.circle_ads_subscriptions FOR SELECT USING (profile_id = public.get_circle_profile_id_safe());
CREATE POLICY "Admins manage subscriptions" ON public.circle_ads_subscriptions FOR ALL USING (public.is_onboarding_admin());

-- Credits
CREATE POLICY "Users can view own credits" ON public.circle_ads_credits FOR SELECT USING (profile_id = public.get_circle_profile_id_safe());
CREATE POLICY "Admins manage credits" ON public.circle_ads_credits FOR ALL USING (public.is_onboarding_admin());

-- Pricing rules - public read
CREATE POLICY "Anyone can view pricing rules" ON public.circle_ads_pricing_rules FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage pricing" ON public.circle_ads_pricing_rules FOR ALL USING (public.is_onboarding_admin());

-- Auctions - only admins and participants
CREATE POLICY "View own auctions" ON public.circle_ads_auctions FOR SELECT USING (
  target_profile_id = public.get_circle_profile_id_safe() OR public.is_onboarding_admin()
);

-- Bids - only admins and bid owners
CREATE POLICY "View own bids" ON public.circle_ads_bids FOR SELECT USING (
  advertiser_profile_id = public.get_circle_profile_id_safe() OR public.is_onboarding_admin()
);

-- AI requests/results
CREATE POLICY "Users can manage own AI requests" ON public.circle_ads_ai_requests FOR ALL USING (profile_id = public.get_circle_profile_id_safe());
CREATE POLICY "Users can view own AI results" ON public.circle_ads_ai_results FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.circle_ads_ai_requests r WHERE r.id = request_id AND r.profile_id = public.get_circle_profile_id_safe()));

-- Privacy settings
CREATE POLICY "Users manage own privacy" ON public.circle_ads_privacy FOR ALL USING (profile_id = public.get_circle_profile_id_safe());

-- Quality scores - public read, system insert
CREATE POLICY "Anyone can view quality scores" ON public.circle_ads_quality_scores FOR SELECT USING (true);

-- Auction history
CREATE POLICY "Users can view own auction history" ON public.circle_ads_auction_history FOR SELECT USING (profile_id = public.get_circle_profile_id_safe());

-- =============================================
-- ADD BID AMOUNT TO ADS TABLE
-- =============================================
ALTER TABLE public.circle_ads_ads ADD COLUMN IF NOT EXISTS bid_amount NUMERIC(10,4) DEFAULT 0.01;

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.update_audience_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audience_updated_at
  BEFORE UPDATE ON public.circle_audiences
  FOR EACH ROW EXECUTE FUNCTION public.update_audience_updated_at();

CREATE TRIGGER trigger_privacy_updated_at
  BEFORE UPDATE ON public.circle_ads_privacy
  FOR EACH ROW EXECUTE FUNCTION public.update_audience_updated_at();