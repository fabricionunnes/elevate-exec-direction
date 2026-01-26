-- =============================================
-- UNV CIRCLE - Social Network Module
-- =============================================

-- Perfis Circle (híbrido com dados existentes)
CREATE TABLE public.circle_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL,
  onboarding_user_id UUID REFERENCES public.onboarding_users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  cover_url TEXT,
  bio TEXT,
  company_name TEXT,
  role_title TEXT,
  interests TEXT[],
  total_points INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  level_name TEXT DEFAULT 'Iniciante',
  privacy_comments TEXT DEFAULT 'everyone' CHECK (privacy_comments IN ('everyone', 'followers', 'nobody')),
  privacy_testimonials TEXT DEFAULT 'everyone' CHECK (privacy_testimonials IN ('everyone', 'followers', 'nobody')),
  whatsapp TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Posts do Feed
CREATE TABLE public.circle_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  community_id UUID,
  content TEXT,
  media_urls TEXT[],
  media_type TEXT CHECK (media_type IN ('image', 'video', 'mixed', NULL)),
  post_type TEXT DEFAULT 'regular' CHECK (post_type IN ('regular', 'achievement', 'shared')),
  shared_post_id UUID REFERENCES public.circle_posts(id) ON DELETE SET NULL,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comentários
CREATE TABLE public.circle_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.circle_posts(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.circle_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Curtidas (polimórficas)
CREATE TABLE public.circle_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'story', 'listing')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, target_type, target_id)
);

-- Posts salvos
CREATE TABLE public.circle_saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.circle_posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, post_id)
);

-- Stories (24h)
CREATE TABLE public.circle_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'text')),
  background_color TEXT,
  views_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Visualizações de Stories
CREATE TABLE public.circle_story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.circle_stories(id) ON DELETE CASCADE NOT NULL,
  viewer_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(story_id, viewer_profile_id)
);

-- Reações em Stories
CREATE TABLE public.circle_story_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.circle_stories(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  reaction_type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Depoimentos
CREATE TABLE public.circle_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  recipient_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_public BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comunidades
CREATE TABLE public.circle_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  cover_url TEXT,
  avatar_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('vendas', 'gestao', 'rh', 'tech', 'lifestyle', 'marketing', 'financeiro', 'outros')),
  is_private BOOLEAN DEFAULT false,
  members_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  owner_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE SET NULL NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Membros de Comunidades
CREATE TABLE public.circle_community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.circle_communities(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(community_id, profile_id)
);

-- =============================================
-- MARKETPLACE
-- =============================================

-- Anúncios do Marketplace
CREATE TABLE public.circle_marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('servicos', 'produtos', 'cursos', 'parcerias', 'oportunidades')),
  offer_type TEXT NOT NULL CHECK (offer_type IN ('venda', 'servico', 'parceria')),
  price DECIMAL(12,2),
  price_type TEXT DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'negotiable', 'free', 'contact')),
  whatsapp TEXT NOT NULL,
  whatsapp_message TEXT,
  views_count INTEGER DEFAULT 0,
  contacts_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'removed')),
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Imagens de Anúncios
CREATE TABLE public.circle_marketplace_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.circle_marketplace_listings(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Denúncias do Marketplace
CREATE TABLE public.circle_marketplace_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.circle_marketplace_listings(id) ON DELETE CASCADE NOT NULL,
  reporter_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE SET NULL NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'scam', 'misleading', 'other')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by UUID REFERENCES public.circle_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Favoritos do Marketplace
CREATE TABLE public.circle_marketplace_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.circle_marketplace_listings(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, listing_id)
);

-- =============================================
-- GAMIFICAÇÃO
-- =============================================

-- Configuração de Pontos
CREATE TABLE public.circle_points_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT UNIQUE NOT NULL,
  points INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir configurações padrão de pontos
INSERT INTO public.circle_points_config (action, points, description) VALUES
  ('post_created', 10, 'Criar um post'),
  ('comment_created', 5, 'Comentar em um post'),
  ('like_given', 1, 'Curtir conteúdo'),
  ('like_received', 2, 'Receber curtida'),
  ('story_created', 5, 'Publicar um story'),
  ('testimonial_given', 15, 'Dar um depoimento'),
  ('testimonial_received', 20, 'Receber um depoimento'),
  ('community_created', 25, 'Criar uma comunidade'),
  ('community_joined', 5, 'Entrar em uma comunidade'),
  ('listing_created', 15, 'Criar anúncio no marketplace'),
  ('listing_contact', 3, 'Contato recebido no marketplace'),
  ('share_post', 5, 'Compartilhar um post');

-- Ledger de Pontos
CREATE TABLE public.circle_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  points INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Níveis
CREATE TABLE public.circle_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir níveis padrão
INSERT INTO public.circle_levels (level, name, min_points, icon, color) VALUES
  (1, 'Iniciante', 0, 'Sprout', 'green'),
  (2, 'Contribuidor', 100, 'MessageSquare', 'blue'),
  (3, 'Influente', 500, 'Star', 'yellow'),
  (4, 'Referência', 1500, 'Award', 'purple'),
  (5, 'Elite', 5000, 'Crown', 'gold');

-- Badges
CREATE TABLE public.circle_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  color TEXT DEFAULT 'blue',
  criteria_type TEXT NOT NULL,
  criteria_value INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir badges padrão
INSERT INTO public.circle_badges (name, description, icon, color, criteria_type, criteria_value) VALUES
  ('Primeiro Post', 'Criou seu primeiro post', 'MessageSquare', 'blue', 'posts_count', 1),
  ('Networker', 'Participou de 5 comunidades', 'Users', 'purple', 'communities_joined', 5),
  ('Influencer', 'Recebeu 50 curtidas', 'Heart', 'red', 'likes_received', 50),
  ('Empreendedor', 'Criou 3 anúncios no marketplace', 'Store', 'green', 'listings_count', 3),
  ('Storyteller', 'Publicou 10 stories', 'Camera', 'yellow', 'stories_count', 10),
  ('Mentor', 'Deu 5 depoimentos', 'Award', 'gold', 'testimonials_given', 5);

-- Badges do Usuário
CREATE TABLE public.circle_user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  badge_id UUID REFERENCES public.circle_badges(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, badge_id)
);

-- =============================================
-- NOTIFICAÇÕES
-- =============================================

CREATE TABLE public.circle_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'testimonial', 'story_reaction', 'listing_contact', 'badge_earned', 'community_invite', 'mention', 'follow')),
  title TEXT NOT NULL,
  message TEXT,
  actor_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE SET NULL,
  reference_type TEXT,
  reference_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- MODERAÇÃO
-- =============================================

CREATE TABLE public.circle_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE SET NULL NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('hide_post', 'remove_post', 'hide_comment', 'remove_comment', 'hide_listing', 'remove_listing', 'suspend_user', 'unsuspend_user', 'warn_user')),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seguir usuários
CREATE TABLE public.circle_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  following_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_profile_id, following_profile_id),
  CHECK(follower_profile_id != following_profile_id)
);

-- =============================================
-- FOREIGN KEY para community_id em posts
-- =============================================
ALTER TABLE public.circle_posts 
ADD CONSTRAINT circle_posts_community_id_fkey 
FOREIGN KEY (community_id) REFERENCES public.circle_communities(id) ON DELETE SET NULL;

-- =============================================
-- TRIGGERS E FUNÇÕES
-- =============================================

-- Trigger para atualizar updated_at
CREATE TRIGGER update_circle_profiles_updated_at
  BEFORE UPDATE ON public.circle_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_circle_posts_updated_at
  BEFORE UPDATE ON public.circle_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_circle_comments_updated_at
  BEFORE UPDATE ON public.circle_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_circle_communities_updated_at
  BEFORE UPDATE ON public.circle_communities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_circle_marketplace_listings_updated_at
  BEFORE UPDATE ON public.circle_marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_circle_testimonials_updated_at
  BEFORE UPDATE ON public.circle_testimonials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para adicionar pontos
CREATE OR REPLACE FUNCTION public.circle_add_points(
  p_profile_id UUID,
  p_action TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_new_total INTEGER;
  v_new_level RECORD;
BEGIN
  -- Get points for action
  SELECT points INTO v_points
  FROM circle_points_config
  WHERE action = p_action AND is_active = true;
  
  IF v_points IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Insert into ledger
  INSERT INTO circle_points_ledger (profile_id, action, points, reference_type, reference_id)
  VALUES (p_profile_id, p_action, v_points, p_reference_type, p_reference_id);
  
  -- Update profile total
  UPDATE circle_profiles
  SET total_points = total_points + v_points
  WHERE id = p_profile_id
  RETURNING total_points INTO v_new_total;
  
  -- Check for level up
  SELECT level, name INTO v_new_level
  FROM circle_levels
  WHERE min_points <= v_new_total
  ORDER BY min_points DESC
  LIMIT 1;
  
  IF v_new_level.level IS NOT NULL THEN
    UPDATE circle_profiles
    SET current_level = v_new_level.level, level_name = v_new_level.name
    WHERE id = p_profile_id AND current_level < v_new_level.level;
  END IF;
  
  RETURN v_points;
END;
$$;

-- Função helper para verificar se é admin do Circle
CREATE OR REPLACE FUNCTION public.is_circle_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role = 'admin'
  )
$$;

-- Função para obter profile_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_circle_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.circle_profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Profiles
ALTER TABLE public.circle_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active profiles"
  ON public.circle_profiles FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can update own profile"
  ON public.circle_profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.circle_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Posts
ALTER TABLE public.circle_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active posts"
  ON public.circle_posts FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can create posts"
  ON public.circle_posts FOR INSERT
  WITH CHECK (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can update own posts"
  ON public.circle_posts FOR UPDATE
  USING (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can delete own posts"
  ON public.circle_posts FOR DELETE
  USING (profile_id = public.get_current_circle_profile_id() OR public.is_circle_admin());

-- Comments
ALTER TABLE public.circle_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active comments"
  ON public.circle_comments FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can create comments"
  ON public.circle_comments FOR INSERT
  WITH CHECK (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can update own comments"
  ON public.circle_comments FOR UPDATE
  USING (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can delete own comments"
  ON public.circle_comments FOR DELETE
  USING (profile_id = public.get_current_circle_profile_id() OR public.is_circle_admin());

-- Likes
ALTER TABLE public.circle_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes"
  ON public.circle_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can create likes"
  ON public.circle_likes FOR INSERT
  WITH CHECK (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can delete own likes"
  ON public.circle_likes FOR DELETE
  USING (profile_id = public.get_current_circle_profile_id());

-- Saved Posts
ALTER TABLE public.circle_saved_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved posts"
  ON public.circle_saved_posts FOR SELECT
  USING (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can save posts"
  ON public.circle_saved_posts FOR INSERT
  WITH CHECK (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can unsave posts"
  ON public.circle_saved_posts FOR DELETE
  USING (profile_id = public.get_current_circle_profile_id());

-- Stories
ALTER TABLE public.circle_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active stories"
  ON public.circle_stories FOR SELECT
  USING (is_active = true AND expires_at > now());

CREATE POLICY "Users can create stories"
  ON public.circle_stories FOR INSERT
  WITH CHECK (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can update own stories"
  ON public.circle_stories FOR UPDATE
  USING (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can delete own stories"
  ON public.circle_stories FOR DELETE
  USING (profile_id = public.get_current_circle_profile_id());

-- Story Views
ALTER TABLE public.circle_story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Story owners can view their views"
  ON public.circle_story_views FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM circle_stories s
    WHERE s.id = story_id AND s.profile_id = public.get_current_circle_profile_id()
  ));

CREATE POLICY "Users can insert views"
  ON public.circle_story_views FOR INSERT
  WITH CHECK (viewer_profile_id = public.get_current_circle_profile_id());

-- Story Reactions
ALTER TABLE public.circle_story_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Story owners can view reactions"
  ON public.circle_story_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM circle_stories s
    WHERE s.id = story_id AND s.profile_id = public.get_current_circle_profile_id()
  ) OR profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can create reactions"
  ON public.circle_story_reactions FOR INSERT
  WITH CHECK (profile_id = public.get_current_circle_profile_id());

-- Testimonials
ALTER TABLE public.circle_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public approved testimonials"
  ON public.circle_testimonials FOR SELECT
  USING (is_public = true AND is_approved = true AND is_active = true);

CREATE POLICY "Users can view own received testimonials"
  ON public.circle_testimonials FOR SELECT
  USING (recipient_profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can create testimonials"
  ON public.circle_testimonials FOR INSERT
  WITH CHECK (author_profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Recipients can update testimonials"
  ON public.circle_testimonials FOR UPDATE
  USING (recipient_profile_id = public.get_current_circle_profile_id());

-- Communities
ALTER TABLE public.circle_communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active communities"
  ON public.circle_communities FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can create communities"
  ON public.circle_communities FOR INSERT
  WITH CHECK (owner_profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Owners can update communities"
  ON public.circle_communities FOR UPDATE
  USING (owner_profile_id = public.get_current_circle_profile_id() OR public.is_circle_admin());

-- Community Members
ALTER TABLE public.circle_community_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view community members"
  ON public.circle_community_members FOR SELECT
  USING (true);

CREATE POLICY "Users can join communities"
  ON public.circle_community_members FOR INSERT
  WITH CHECK (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can leave communities"
  ON public.circle_community_members FOR DELETE
  USING (profile_id = public.get_current_circle_profile_id());

-- Marketplace Listings
ALTER TABLE public.circle_marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings"
  ON public.circle_marketplace_listings FOR SELECT
  USING (status = 'active');

CREATE POLICY "Users can create listings"
  ON public.circle_marketplace_listings FOR INSERT
  WITH CHECK (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can update own listings"
  ON public.circle_marketplace_listings FOR UPDATE
  USING (profile_id = public.get_current_circle_profile_id() OR public.is_circle_admin());

CREATE POLICY "Users can delete own listings"
  ON public.circle_marketplace_listings FOR DELETE
  USING (profile_id = public.get_current_circle_profile_id() OR public.is_circle_admin());

-- Marketplace Images
ALTER TABLE public.circle_marketplace_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view listing images"
  ON public.circle_marketplace_images FOR SELECT
  USING (true);

CREATE POLICY "Listing owners can manage images"
  ON public.circle_marketplace_images FOR ALL
  USING (EXISTS (
    SELECT 1 FROM circle_marketplace_listings l
    WHERE l.id = listing_id AND l.profile_id = public.get_current_circle_profile_id()
  ));

-- Marketplace Reports
ALTER TABLE public.circle_marketplace_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
  ON public.circle_marketplace_reports FOR INSERT
  WITH CHECK (reporter_profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Admins can view reports"
  ON public.circle_marketplace_reports FOR SELECT
  USING (public.is_circle_admin());

CREATE POLICY "Admins can update reports"
  ON public.circle_marketplace_reports FOR UPDATE
  USING (public.is_circle_admin());

-- Marketplace Favorites
ALTER TABLE public.circle_marketplace_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON public.circle_marketplace_favorites FOR SELECT
  USING (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can add favorites"
  ON public.circle_marketplace_favorites FOR INSERT
  WITH CHECK (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can remove favorites"
  ON public.circle_marketplace_favorites FOR DELETE
  USING (profile_id = public.get_current_circle_profile_id());

-- Points Config
ALTER TABLE public.circle_points_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view points config"
  ON public.circle_points_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage points config"
  ON public.circle_points_config FOR ALL
  USING (public.is_circle_admin());

-- Points Ledger
ALTER TABLE public.circle_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own points"
  ON public.circle_points_ledger FOR SELECT
  USING (profile_id = public.get_current_circle_profile_id() OR public.is_circle_admin());

-- Levels
ALTER TABLE public.circle_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view levels"
  ON public.circle_levels FOR SELECT
  USING (true);

-- Badges
ALTER TABLE public.circle_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badges"
  ON public.circle_badges FOR SELECT
  USING (true);

-- User Badges
ALTER TABLE public.circle_user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user badges"
  ON public.circle_user_badges FOR SELECT
  USING (true);

-- Notifications
ALTER TABLE public.circle_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.circle_notifications FOR SELECT
  USING (profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can update own notifications"
  ON public.circle_notifications FOR UPDATE
  USING (profile_id = public.get_current_circle_profile_id());

-- Moderation Logs
ALTER TABLE public.circle_moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view moderation logs"
  ON public.circle_moderation_logs FOR SELECT
  USING (public.is_circle_admin());

CREATE POLICY "Admins can create moderation logs"
  ON public.circle_moderation_logs FOR INSERT
  WITH CHECK (public.is_circle_admin());

-- Follows
ALTER TABLE public.circle_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows"
  ON public.circle_follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow"
  ON public.circle_follows FOR INSERT
  WITH CHECK (follower_profile_id = public.get_current_circle_profile_id());

CREATE POLICY "Users can unfollow"
  ON public.circle_follows FOR DELETE
  USING (follower_profile_id = public.get_current_circle_profile_id());

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_circle_posts_profile_id ON public.circle_posts(profile_id);
CREATE INDEX idx_circle_posts_community_id ON public.circle_posts(community_id);
CREATE INDEX idx_circle_posts_created_at ON public.circle_posts(created_at DESC);
CREATE INDEX idx_circle_comments_post_id ON public.circle_comments(post_id);
CREATE INDEX idx_circle_likes_target ON public.circle_likes(target_type, target_id);
CREATE INDEX idx_circle_stories_profile_id ON public.circle_stories(profile_id);
CREATE INDEX idx_circle_stories_expires_at ON public.circle_stories(expires_at);
CREATE INDEX idx_circle_marketplace_listings_category ON public.circle_marketplace_listings(category);
CREATE INDEX idx_circle_marketplace_listings_status ON public.circle_marketplace_listings(status);
CREATE INDEX idx_circle_points_ledger_profile_id ON public.circle_points_ledger(profile_id);
CREATE INDEX idx_circle_notifications_profile_id ON public.circle_notifications(profile_id);
CREATE INDEX idx_circle_notifications_is_read ON public.circle_notifications(is_read);
CREATE INDEX idx_circle_follows_follower ON public.circle_follows(follower_profile_id);
CREATE INDEX idx_circle_follows_following ON public.circle_follows(following_profile_id);
CREATE INDEX idx_circle_community_members_community ON public.circle_community_members(community_id);
CREATE INDEX idx_circle_community_members_profile ON public.circle_community_members(profile_id);