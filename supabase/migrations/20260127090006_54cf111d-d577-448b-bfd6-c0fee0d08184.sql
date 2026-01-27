-- =====================================================
-- PHASE 2 & 3: AI, SCALE, MONETIZATION & MENTORING
-- =====================================================

-- =====================================================
-- PHASE 2: SOCIAL INTELLIGENCE
-- =====================================================

-- 5) AI Content Quality Suggestions
CREATE TABLE public.circle_ai_content_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  original_content TEXT NOT NULL,
  suggestions JSONB NOT NULL DEFAULT '{}',
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('clarity', 'tone', 'cta', 'hashtags', 'objective')),
  was_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6) Community Summaries (AI-generated)
CREATE TABLE public.circle_community_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.circle_communities(id) ON DELETE CASCADE NOT NULL,
  summary_content TEXT NOT NULL,
  main_topics TEXT[] DEFAULT '{}',
  top_posts UUID[] DEFAULT '{}',
  top_contributors UUID[] DEFAULT '{}',
  insights TEXT[] DEFAULT '{}',
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(community_id, week_start)
);

-- 7) Area Reputation (Multi-Reputation)
CREATE TABLE public.circle_area_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  area TEXT NOT NULL CHECK (area IN ('vendas', 'gestao', 'marketing', 'rh', 'tech', 'financeiro', 'lideranca', 'atendimento')),
  reputation_score INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  level_name TEXT DEFAULT 'Iniciante',
  posts_count INTEGER DEFAULT 0,
  likes_received INTEGER DEFAULT 0,
  comments_received INTEGER DEFAULT 0,
  testimonials_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, area)
);

-- Area reputation events log
CREATE TABLE public.circle_area_reputation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  area TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('post', 'like_received', 'comment_received', 'testimonial', 'community_engagement')),
  points INTEGER NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- PHASE 3: SCALE, MONETIZATION & MENTORING
-- =====================================================

-- 8) Post Boosts
CREATE TABLE public.circle_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.circle_posts(id) ON DELETE CASCADE NOT NULL,
  boost_type TEXT NOT NULL CHECK (boost_type IN ('visibility', 'highlight', 'featured')),
  start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at TIMESTAMPTZ NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Monthly boost limits per user
CREATE TABLE public.circle_boost_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  month_year TEXT NOT NULL, -- Format: '2026-01'
  boosts_used INTEGER DEFAULT 0,
  boosts_limit INTEGER DEFAULT 5,
  UNIQUE(profile_id, month_year)
);

-- Boost configuration (admin-managed)
CREATE TABLE public.circle_boost_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_trust_score INTEGER DEFAULT 50,
  monthly_boost_limit INTEGER DEFAULT 5,
  boost_duration_hours INTEGER DEFAULT 48,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default boost config
INSERT INTO public.circle_boost_config (min_trust_score, monthly_boost_limit, boost_duration_hours)
VALUES (50, 5, 48);

-- 9) Private Communities / Subscriptions
CREATE TABLE public.circle_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.circle_communities(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_type TEXT DEFAULT 'free' CHECK (subscription_type IN ('free', 'premium', 'vip')),
  access_level TEXT DEFAULT 'member' CHECK (access_level IN ('viewer', 'member', 'premium_member')),
  invited_by UUID REFERENCES public.circle_profiles(id) ON DELETE SET NULL,
  invite_code TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(community_id, profile_id)
);

-- Community access settings
CREATE TABLE public.circle_community_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.circle_communities(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_type TEXT DEFAULT 'public' CHECK (access_type IN ('public', 'private', 'invite_only', 'subscription')),
  require_approval BOOLEAN DEFAULT false,
  min_trust_score INTEGER DEFAULT 0,
  invite_code TEXT UNIQUE,
  max_members INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pending join requests for private communities
CREATE TABLE public.circle_community_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.circle_communities(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  request_message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.circle_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(community_id, profile_id)
);

-- 10) AI Mentor Sessions
CREATE TABLE public.circle_mentor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('profile_analysis', 'growth_plan', 'content_strategy', 'reputation_boost', 'general')),
  context JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '{}',
  goals TEXT[] DEFAULT '{}',
  action_items JSONB DEFAULT '[]',
  completed_items INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Mentor chat messages
CREATE TABLE public.circle_mentor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.circle_mentor_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- ADD COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add boost indicator to posts
ALTER TABLE public.circle_posts 
ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS boost_id UUID REFERENCES public.circle_boosts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ai_quality_score INTEGER;

-- Add area to posts for reputation tracking
ALTER TABLE public.circle_posts
ADD COLUMN IF NOT EXISTS content_area TEXT CHECK (content_area IN ('vendas', 'gestao', 'marketing', 'rh', 'tech', 'financeiro', 'lideranca', 'atendimento', NULL));

-- Add exclusive content flag
ALTER TABLE public.circle_posts
ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN DEFAULT false;

-- =====================================================
-- FUNCTIONS FOR AREA REPUTATION
-- =====================================================

-- Function to calculate area reputation level
CREATE OR REPLACE FUNCTION public.get_area_reputation_level(score INTEGER)
RETURNS TABLE(level INTEGER, level_name TEXT) AS $$
BEGIN
  IF score >= 1000 THEN
    RETURN QUERY SELECT 5, 'Expert'::TEXT;
  ELSIF score >= 500 THEN
    RETURN QUERY SELECT 4, 'Avançado'::TEXT;
  ELSIF score >= 200 THEN
    RETURN QUERY SELECT 3, 'Intermediário'::TEXT;
  ELSIF score >= 50 THEN
    RETURN QUERY SELECT 2, 'Aprendiz'::TEXT;
  ELSE
    RETURN QUERY SELECT 1, 'Iniciante'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger to update area reputation on events
CREATE OR REPLACE FUNCTION public.update_area_reputation()
RETURNS TRIGGER AS $$
DECLARE
  v_level_info RECORD;
  v_new_score INTEGER;
BEGIN
  -- Upsert area reputation
  INSERT INTO public.circle_area_reputation (profile_id, area, reputation_score)
  VALUES (NEW.profile_id, NEW.area, NEW.points)
  ON CONFLICT (profile_id, area) 
  DO UPDATE SET 
    reputation_score = circle_area_reputation.reputation_score + NEW.points,
    updated_at = now();

  -- Get new score
  SELECT reputation_score INTO v_new_score
  FROM public.circle_area_reputation
  WHERE profile_id = NEW.profile_id AND area = NEW.area;

  -- Update level
  SELECT * INTO v_level_info FROM public.get_area_reputation_level(v_new_score);
  
  UPDATE public.circle_area_reputation
  SET level = v_level_info.level, level_name = v_level_info.level_name
  WHERE profile_id = NEW.profile_id AND area = NEW.area;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_area_reputation_event
  AFTER INSERT ON public.circle_area_reputation_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_area_reputation();

-- =====================================================
-- FUNCTIONS FOR BOOSTS
-- =====================================================

-- Function to check if user can boost
CREATE OR REPLACE FUNCTION public.can_user_boost(check_profile_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_trust_score INTEGER;
  v_min_trust INTEGER;
  v_current_month TEXT;
  v_boosts_used INTEGER;
  v_boost_limit INTEGER;
BEGIN
  -- Get user trust score
  SELECT COALESCE(trust_score, 50) INTO v_trust_score
  FROM public.circle_profiles
  WHERE id = check_profile_id;

  -- Get config
  SELECT min_trust_score, monthly_boost_limit INTO v_min_trust, v_boost_limit
  FROM public.circle_boost_config
  LIMIT 1;

  -- Check trust score
  IF v_trust_score < v_min_trust THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'trust_score', 'required', v_min_trust, 'current', v_trust_score);
  END IF;

  -- Get current month usage
  v_current_month := to_char(now(), 'YYYY-MM');
  
  SELECT COALESCE(boosts_used, 0) INTO v_boosts_used
  FROM public.circle_boost_limits
  WHERE profile_id = check_profile_id AND month_year = v_current_month;

  IF v_boosts_used >= v_boost_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'used', v_boosts_used, 'limit', v_boost_limit);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'remaining', v_boost_limit - COALESCE(v_boosts_used, 0));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Trigger to update boost usage
CREATE OR REPLACE FUNCTION public.track_boost_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_current_month TEXT;
BEGIN
  v_current_month := to_char(now(), 'YYYY-MM');
  
  INSERT INTO public.circle_boost_limits (profile_id, month_year, boosts_used)
  VALUES (NEW.profile_id, v_current_month, 1)
  ON CONFLICT (profile_id, month_year) 
  DO UPDATE SET boosts_used = circle_boost_limits.boosts_used + 1;

  -- Mark post as boosted
  UPDATE public.circle_posts
  SET is_boosted = true, boost_id = NEW.id
  WHERE id = NEW.post_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_boost_created
  AFTER INSERT ON public.circle_boosts
  FOR EACH ROW
  EXECUTE FUNCTION public.track_boost_usage();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- AI Content Suggestions
ALTER TABLE public.circle_ai_content_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suggestions"
  ON public.circle_ai_content_suggestions FOR SELECT
  USING (profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own suggestions"
  ON public.circle_ai_content_suggestions FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid()));

-- Community Summaries
ALTER TABLE public.circle_community_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Community members can view summaries"
  ON public.circle_community_summaries FOR SELECT
  USING (
    community_id IN (
      SELECT community_id FROM public.circle_community_members 
      WHERE profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid())
    )
  );

-- Area Reputation (public view)
ALTER TABLE public.circle_area_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view area reputation"
  ON public.circle_area_reputation FOR SELECT
  USING (true);

CREATE POLICY "System can manage area reputation"
  ON public.circle_area_reputation FOR ALL
  USING (true)
  WITH CHECK (true);

-- Area Reputation Events
ALTER TABLE public.circle_area_reputation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events"
  ON public.circle_area_reputation_events FOR SELECT
  USING (profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid()));

CREATE POLICY "System can create events"
  ON public.circle_area_reputation_events FOR INSERT
  WITH CHECK (true);

-- Boosts
ALTER TABLE public.circle_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own boosts"
  ON public.circle_boosts FOR SELECT
  USING (profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own boosts"
  ON public.circle_boosts FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid()));

-- Boost Limits
ALTER TABLE public.circle_boost_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own limits"
  ON public.circle_boost_limits FOR SELECT
  USING (profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid()));

-- Boost Config (read-only for all)
ALTER TABLE public.circle_boost_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view boost config"
  ON public.circle_boost_config FOR SELECT
  USING (true);

-- Subscriptions
ALTER TABLE public.circle_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.circle_subscriptions FOR SELECT
  USING (profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own subscriptions"
  ON public.circle_subscriptions FOR ALL
  USING (profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid()));

-- Community Access
ALTER TABLE public.circle_community_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view community access"
  ON public.circle_community_access FOR SELECT
  USING (true);

CREATE POLICY "Community owners can manage access"
  ON public.circle_community_access FOR ALL
  USING (
    community_id IN (
      SELECT id FROM public.circle_communities 
      WHERE owner_profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid())
    )
  );

-- Community Requests
ALTER TABLE public.circle_community_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON public.circle_community_requests FOR SELECT
  USING (profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Community owners can view requests"
  ON public.circle_community_requests FOR SELECT
  USING (
    community_id IN (
      SELECT id FROM public.circle_communities 
      WHERE owner_profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create requests"
  ON public.circle_community_requests FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Community owners can update requests"
  ON public.circle_community_requests FOR UPDATE
  USING (
    community_id IN (
      SELECT id FROM public.circle_communities 
      WHERE owner_profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid())
    )
  );

-- Mentor Sessions
ALTER TABLE public.circle_mentor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.circle_mentor_sessions FOR SELECT
  USING (profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own sessions"
  ON public.circle_mentor_sessions FOR ALL
  USING (profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid()));

-- Mentor Messages
ALTER TABLE public.circle_mentor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session messages"
  ON public.circle_mentor_messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.circle_mentor_sessions 
      WHERE profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create messages in own sessions"
  ON public.circle_mentor_messages FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.circle_mentor_sessions 
      WHERE profile_id IN (SELECT id FROM public.circle_profiles WHERE user_id = auth.uid())
    )
  );