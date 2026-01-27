-- Fix the badge check function to use correct column names for marketplace listings
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
        JOIN public.circle_posts p ON p.id = l.target_id AND l.target_type = 'post'
        WHERE p.profile_id = p_profile_id;
        v_should_award := v_count >= COALESCE(v_badge.criteria_value, 50);
        
      WHEN 'listings_count' THEN
        -- marketplace uses status = 'active' instead of is_active
        SELECT COUNT(*) INTO v_count FROM public.circle_marketplace_listings WHERE profile_id = p_profile_id AND status = 'active';
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