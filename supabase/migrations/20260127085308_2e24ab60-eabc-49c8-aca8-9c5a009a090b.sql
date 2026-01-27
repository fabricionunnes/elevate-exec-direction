-- =============================================
-- FASE 1: TRUST SCORE, REPUTAÇÃO E NOTIFICAÇÕES
-- =============================================

-- 1. TRUST SCORE CONFIGURATION (Admin pode configurar)
CREATE TABLE public.circle_trust_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_score_post_links INTEGER NOT NULL DEFAULT 30,
  min_score_create_listings INTEGER NOT NULL DEFAULT 40,
  min_score_create_communities INTEGER NOT NULL DEFAULT 50,
  min_score_boost_posts INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default config
INSERT INTO public.circle_trust_config (id) VALUES (gen_random_uuid());

-- 2. TRUST SCORE EVENTS (Histórico de eventos que afetam o score)
CREATE TABLE public.circle_trust_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.circle_profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  points INTEGER NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trust_events_profile ON public.circle_trust_events(profile_id);
CREATE INDEX idx_trust_events_type ON public.circle_trust_events(event_type);

-- 3. Adicionar trust_score ao perfil
ALTER TABLE public.circle_profiles 
ADD COLUMN IF NOT EXISTS trust_score INTEGER NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS trust_score_updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS badges_list TEXT[] DEFAULT '{}';

-- 4. MARKETPLACE ANALYTICS (usando a tabela correta circle_marketplace_listings)
CREATE TABLE public.circle_marketplace_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.circle_marketplace_listings(id) ON DELETE CASCADE,
  view_count INTEGER NOT NULL DEFAULT 0,
  whatsapp_clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(listing_id)
);

-- 5. MARKETPLACE CLICK EVENTS (Para analytics detalhado)
CREATE TABLE public.circle_marketplace_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.circle_marketplace_listings(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_events_listing ON public.circle_marketplace_events(listing_id);
CREATE INDEX idx_marketplace_events_date ON public.circle_marketplace_events(created_at);

-- 6. REPORTS/DENÚNCIAS GERAIS (além do marketplace que já tem)
CREATE TABLE public.circle_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_profile_id UUID NOT NULL REFERENCES public.circle_profiles(id) ON DELETE CASCADE,
  reported_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_id UUID,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.circle_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_status ON public.circle_reports(status);
CREATE INDEX idx_reports_reported ON public.circle_reports(reported_profile_id);

-- 7. NOTIFICATION CENTER (Melhorias)
ALTER TABLE public.circle_notifications
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS action_url TEXT;

-- 8. DIGEST SETTINGS
CREATE TABLE public.circle_digest_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.circle_profiles(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'daily',
  include_feed_highlights BOOLEAN NOT NULL DEFAULT true,
  include_community_activity BOOLEAN NOT NULL DEFAULT true,
  include_ranking BOOLEAN NOT NULL DEFAULT true,
  include_marketplace BOOLEAN NOT NULL DEFAULT true,
  preferred_time TIME DEFAULT '09:00:00',
  last_sent_at TIMESTAMPTZ,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

-- 9. DIGEST HISTORY
CREATE TABLE public.circle_digest_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.circle_profiles(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  sent_via TEXT NOT NULL DEFAULT 'email',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_digest_history_profile ON public.circle_digest_history(profile_id);

-- 10. STRUCTURED COMMENTS (Tipos de comentário)
ALTER TABLE public.circle_comments
ADD COLUMN IF NOT EXISTS comment_type TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.circle_profiles(id),
ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

-- 11. USER BLOCKS
CREATE TABLE public.circle_user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_profile_id UUID NOT NULL REFERENCES public.circle_profiles(id) ON DELETE CASCADE,
  blocked_profile_id UUID NOT NULL REFERENCES public.circle_profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(blocker_profile_id, blocked_profile_id)
);

CREATE INDEX idx_blocks_blocker ON public.circle_user_blocks(blocker_profile_id);
CREATE INDEX idx_blocks_blocked ON public.circle_user_blocks(blocked_profile_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.circle_trust_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view trust config" ON public.circle_trust_config FOR SELECT USING (true);
CREATE POLICY "Only admins can update trust config" ON public.circle_trust_config FOR UPDATE USING (public.is_onboarding_admin());

ALTER TABLE public.circle_trust_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own trust events" ON public.circle_trust_events FOR SELECT USING (profile_id = public.get_circle_profile_id());
CREATE POLICY "System can insert trust events" ON public.circle_trust_events FOR INSERT WITH CHECK (true);

ALTER TABLE public.circle_marketplace_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view marketplace analytics" ON public.circle_marketplace_analytics FOR SELECT USING (true);
CREATE POLICY "System can manage marketplace analytics" ON public.circle_marketplace_analytics FOR ALL USING (true);

ALTER TABLE public.circle_marketplace_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert marketplace events" ON public.circle_marketplace_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Listing owners can view their events" ON public.circle_marketplace_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.circle_marketplace_listings l
    WHERE l.id = listing_id AND l.profile_id = public.get_circle_profile_id()
  )
);

ALTER TABLE public.circle_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.circle_reports FOR INSERT WITH CHECK (reporter_profile_id = public.get_circle_profile_id());
CREATE POLICY "Users can view their own reports" ON public.circle_reports FOR SELECT USING (reporter_profile_id = public.get_circle_profile_id() OR public.is_onboarding_admin());
CREATE POLICY "Admins can update reports" ON public.circle_reports FOR UPDATE USING (public.is_onboarding_admin());

ALTER TABLE public.circle_digest_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their digest settings" ON public.circle_digest_settings FOR ALL USING (profile_id = public.get_circle_profile_id());

ALTER TABLE public.circle_digest_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their digest history" ON public.circle_digest_history FOR SELECT USING (profile_id = public.get_circle_profile_id());

ALTER TABLE public.circle_user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their blocks" ON public.circle_user_blocks FOR ALL USING (blocker_profile_id = public.get_circle_profile_id());

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para criar analytics quando listing é criado
CREATE OR REPLACE FUNCTION public.create_marketplace_analytics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.circle_marketplace_analytics (listing_id)
  VALUES (NEW.id)
  ON CONFLICT (listing_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_create_marketplace_analytics
AFTER INSERT ON public.circle_marketplace_listings
FOR EACH ROW
EXECUTE FUNCTION public.create_marketplace_analytics();

-- Trigger para atualizar analytics em eventos
CREATE OR REPLACE FUNCTION public.update_marketplace_analytics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'view' THEN
    UPDATE public.circle_marketplace_analytics
    SET view_count = view_count + 1, updated_at = now()
    WHERE listing_id = NEW.listing_id;
  ELSIF NEW.event_type = 'whatsapp_click' THEN
    UPDATE public.circle_marketplace_analytics
    SET whatsapp_clicks = whatsapp_clicks + 1, updated_at = now()
    WHERE listing_id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_marketplace_analytics
AFTER INSERT ON public.circle_marketplace_events
FOR EACH ROW
EXECUTE FUNCTION public.update_marketplace_analytics();

-- Trigger para recalcular trust score
CREATE OR REPLACE FUNCTION public.recalculate_trust_score()
RETURNS TRIGGER AS $$
DECLARE
  v_total_points INTEGER;
  v_new_score INTEGER;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO v_total_points
  FROM public.circle_trust_events
  WHERE profile_id = NEW.profile_id;
  
  v_new_score := GREATEST(0, LEAST(100, 50 + v_total_points));
  
  UPDATE public.circle_profiles
  SET trust_score = v_new_score, trust_score_updated_at = now()
  WHERE id = NEW.profile_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_recalculate_trust_score
AFTER INSERT ON public.circle_trust_events
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_trust_score();

-- Trigger para penalizar trust score em denúncia confirmada
CREATE OR REPLACE FUNCTION public.handle_report_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' AND NEW.reported_profile_id IS NOT NULL THEN
    INSERT INTO public.circle_trust_events (profile_id, event_type, points, description, reference_type, reference_id)
    VALUES (NEW.reported_profile_id, 'report_confirmed', -10, 'Denúncia confirmada: ' || NEW.reason, 'report', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_handle_report_confirmed
AFTER UPDATE ON public.circle_reports
FOR EACH ROW
EXECUTE FUNCTION public.handle_report_confirmed();

-- Trigger para adicionar pontos por bloqueio recebido
CREATE OR REPLACE FUNCTION public.handle_user_blocked()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.circle_trust_events (profile_id, event_type, points, description, reference_type, reference_id)
  VALUES (NEW.blocked_profile_id, 'block_received', -2, 'Bloqueado por outro usuário', 'block', NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_handle_user_blocked
AFTER INSERT ON public.circle_user_blocks
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_blocked();

-- Criar digest settings automaticamente para novos perfis
CREATE OR REPLACE FUNCTION public.create_circle_digest_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.circle_digest_settings (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_create_circle_digest_settings
AFTER INSERT ON public.circle_profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_circle_digest_settings();

-- Criar digest settings para perfis existentes
INSERT INTO public.circle_digest_settings (profile_id)
SELECT id FROM public.circle_profiles
ON CONFLICT (profile_id) DO NOTHING;

-- Criar analytics para listings existentes
INSERT INTO public.circle_marketplace_analytics (listing_id)
SELECT id FROM public.circle_marketplace_listings
ON CONFLICT (listing_id) DO NOTHING;