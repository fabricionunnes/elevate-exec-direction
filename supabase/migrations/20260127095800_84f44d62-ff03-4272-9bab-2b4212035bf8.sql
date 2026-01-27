-- =====================================================
-- NOTIFICATION TRIGGERS
-- =====================================================

-- 1. Trigger for new follow notifications
CREATE OR REPLACE FUNCTION public.notify_circle_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_follower_name TEXT;
BEGIN
  -- Get follower name
  SELECT display_name INTO v_follower_name
  FROM public.circle_profiles
  WHERE id = NEW.follower_profile_id;

  -- Create notification for the followed user
  INSERT INTO public.circle_notifications (
    profile_id,
    type,
    title,
    message,
    actor_profile_id,
    reference_type,
    reference_id,
    category,
    priority
  ) VALUES (
    NEW.following_profile_id,
    'follow',
    COALESCE(v_follower_name, 'Alguém') || ' começou a seguir você',
    'Você tem um novo seguidor!',
    NEW.follower_profile_id,
    'profile',
    NEW.follower_profile_id,
    'engagement',
    'normal'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_circle_follow ON public.circle_follows;
CREATE TRIGGER trigger_notify_circle_follow
  AFTER INSERT ON public.circle_follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_circle_follow();

-- 2. Trigger for new message notifications
CREATE OR REPLACE FUNCTION public.notify_circle_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name TEXT;
  v_recipient_id UUID;
BEGIN
  -- Get sender name
  SELECT display_name INTO v_sender_name
  FROM public.circle_profiles
  WHERE id = NEW.sender_profile_id;

  -- Get the other participant (recipient)
  SELECT profile_id INTO v_recipient_id
  FROM public.circle_conversation_participants
  WHERE conversation_id = NEW.conversation_id
    AND profile_id != NEW.sender_profile_id
  LIMIT 1;

  IF v_recipient_id IS NOT NULL THEN
    -- Create notification for the recipient
    INSERT INTO public.circle_notifications (
      profile_id,
      type,
      title,
      message,
      actor_profile_id,
      reference_type,
      reference_id,
      action_url,
      category,
      priority
    ) VALUES (
      v_recipient_id,
      'comment', -- Using 'comment' type for messages
      COALESCE(v_sender_name, 'Alguém') || ' enviou uma mensagem',
      LEFT(NEW.content, 100),
      NEW.sender_profile_id,
      'conversation',
      NEW.conversation_id,
      '/circle/messages?conversation=' || NEW.conversation_id::text,
      'comments',
      'normal'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_circle_message ON public.circle_messages;
CREATE TRIGGER trigger_notify_circle_message
  AFTER INSERT ON public.circle_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_circle_message();

-- 3. Trigger for new testimonial notifications (pending approval)
CREATE OR REPLACE FUNCTION public.notify_circle_testimonial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_name TEXT;
BEGIN
  -- Get author name
  SELECT display_name INTO v_author_name
  FROM public.circle_profiles
  WHERE id = NEW.author_profile_id;

  -- Create notification for the recipient
  INSERT INTO public.circle_notifications (
    profile_id,
    type,
    title,
    message,
    actor_profile_id,
    reference_type,
    reference_id,
    action_url,
    category,
    priority
  ) VALUES (
    NEW.recipient_profile_id,
    'testimonial',
    COALESCE(v_author_name, 'Alguém') || ' enviou um depoimento para você',
    'Você precisa aprovar este depoimento para que ele apareça no seu perfil.',
    NEW.author_profile_id,
    'testimonial',
    NEW.id,
    '/circle/profile',
    'engagement',
    'high'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_circle_testimonial ON public.circle_testimonials;
CREATE TRIGGER trigger_notify_circle_testimonial
  AFTER INSERT ON public.circle_testimonials
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_circle_testimonial();

-- =====================================================
-- BADGE AWARDING TRIGGERS
-- =====================================================

-- Function to check and award badges to a profile
CREATE OR REPLACE FUNCTION public.check_and_award_circle_badges(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge RECORD;
  v_count INTEGER;
  v_should_award BOOLEAN;
BEGIN
  FOR v_badge IN SELECT * FROM public.circle_badges WHERE is_active = true LOOP
    v_should_award := false;
    
    -- Check if user already has this badge
    IF EXISTS (SELECT 1 FROM public.circle_user_badges WHERE profile_id = p_profile_id AND badge_id = v_badge.id) THEN
      CONTINUE;
    END IF;

    -- Check criteria
    CASE v_badge.criteria_type
      WHEN 'posts_count' THEN
        SELECT COUNT(*) INTO v_count FROM public.circle_posts WHERE profile_id = p_profile_id AND is_active = true;
        v_should_award := v_count >= COALESCE(v_badge.criteria_value, 1);
        
      WHEN 'communities_joined' THEN
        SELECT COUNT(*) INTO v_count FROM public.circle_community_members WHERE profile_id = p_profile_id;
        v_should_award := v_count >= COALESCE(v_badge.criteria_value, 5);
        
      WHEN 'likes_received' THEN
        SELECT COUNT(*) INTO v_count FROM public.circle_likes l
        JOIN public.circle_posts p ON p.id = l.post_id
        WHERE p.profile_id = p_profile_id;
        v_should_award := v_count >= COALESCE(v_badge.criteria_value, 50);
        
      WHEN 'listings_count' THEN
        SELECT COUNT(*) INTO v_count FROM public.circle_marketplace_listings WHERE profile_id = p_profile_id AND is_active = true;
        v_should_award := v_count >= COALESCE(v_badge.criteria_value, 3);
        
      WHEN 'stories_count' THEN
        SELECT COUNT(*) INTO v_count FROM public.circle_stories WHERE profile_id = p_profile_id AND is_active = true;
        v_should_award := v_count >= COALESCE(v_badge.criteria_value, 10);
        
      WHEN 'testimonials_given' THEN
        SELECT COUNT(*) INTO v_count FROM public.circle_testimonials WHERE author_profile_id = p_profile_id AND is_approved = true AND is_active = true;
        v_should_award := v_count >= COALESCE(v_badge.criteria_value, 5);
        
      ELSE
        v_should_award := false;
    END CASE;

    -- Award badge if criteria met
    IF v_should_award THEN
      INSERT INTO public.circle_user_badges (profile_id, badge_id)
      VALUES (p_profile_id, v_badge.id)
      ON CONFLICT (profile_id, badge_id) DO NOTHING;
      
      -- Create notification for badge earned
      INSERT INTO public.circle_notifications (
        profile_id,
        type,
        title,
        message,
        reference_type,
        reference_id,
        category,
        priority
      ) VALUES (
        p_profile_id,
        'badge_earned',
        'Você ganhou a badge "' || v_badge.name || '"!',
        v_badge.description,
        'badge',
        v_badge.id,
        'engagement',
        'normal'
      );
    END IF;
  END LOOP;
END;
$$;

-- Trigger on posts to check badges
CREATE OR REPLACE FUNCTION public.trigger_check_badges_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_and_award_circle_badges(NEW.profile_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_badges_on_post ON public.circle_posts;
CREATE TRIGGER trigger_badges_on_post
  AFTER INSERT ON public.circle_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_check_badges_on_post();

-- Trigger on stories to check badges
CREATE OR REPLACE FUNCTION public.trigger_check_badges_on_story()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_and_award_circle_badges(NEW.profile_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_badges_on_story ON public.circle_stories;
CREATE TRIGGER trigger_badges_on_story
  AFTER INSERT ON public.circle_stories
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_check_badges_on_story();

-- Trigger on likes to check badges for post owner
CREATE OR REPLACE FUNCTION public.trigger_check_badges_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner UUID;
BEGIN
  SELECT profile_id INTO v_post_owner FROM public.circle_posts WHERE id = NEW.post_id;
  IF v_post_owner IS NOT NULL THEN
    PERFORM public.check_and_award_circle_badges(v_post_owner);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_badges_on_like ON public.circle_likes;
CREATE TRIGGER trigger_badges_on_like
  AFTER INSERT ON public.circle_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_check_badges_on_like();

-- Trigger on community membership to check badges
CREATE OR REPLACE FUNCTION public.trigger_check_badges_on_community_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_and_award_circle_badges(NEW.profile_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_badges_on_community_join ON public.circle_community_members;
CREATE TRIGGER trigger_badges_on_community_join
  AFTER INSERT ON public.circle_community_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_check_badges_on_community_join();

-- Trigger on marketplace listings to check badges
CREATE OR REPLACE FUNCTION public.trigger_check_badges_on_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.check_and_award_circle_badges(NEW.profile_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_badges_on_listing ON public.circle_marketplace_listings;
CREATE TRIGGER trigger_badges_on_listing
  AFTER INSERT ON public.circle_marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_check_badges_on_listing();

-- Trigger on testimonials given to check badges for author
CREATE OR REPLACE FUNCTION public.trigger_check_badges_on_testimonial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_approved = true THEN
    PERFORM public.check_and_award_circle_badges(NEW.author_profile_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_badges_on_testimonial ON public.circle_testimonials;
CREATE TRIGGER trigger_badges_on_testimonial
  AFTER INSERT OR UPDATE OF is_approved ON public.circle_testimonials
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_check_badges_on_testimonial();