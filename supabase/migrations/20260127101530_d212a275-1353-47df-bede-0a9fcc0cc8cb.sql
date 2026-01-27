-- =====================================================
-- 1. Add notification types for story interactions
-- =====================================================

-- First, update the circle_notifications type check to include new types
ALTER TABLE public.circle_notifications 
DROP CONSTRAINT IF EXISTS circle_notifications_type_check;

ALTER TABLE public.circle_notifications 
ADD CONSTRAINT circle_notifications_type_check 
CHECK (type IN ('like', 'comment', 'testimonial', 'story_reaction', 'listing_contact', 'badge_earned', 'community_invite', 'mention', 'follow', 'story_view', 'story_comment'));

-- =====================================================
-- 2. Create trigger for story view notifications
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_story_view()
RETURNS TRIGGER AS $$
DECLARE
  v_story_owner_id UUID;
  v_viewer_name TEXT;
BEGIN
  -- Get story owner
  SELECT profile_id INTO v_story_owner_id
  FROM public.circle_stories
  WHERE id = NEW.story_id;

  -- Don't notify if viewing own story
  IF v_story_owner_id = NEW.viewer_profile_id THEN
    RETURN NEW;
  END IF;

  -- Get viewer name
  SELECT display_name INTO v_viewer_name
  FROM public.circle_profiles
  WHERE id = NEW.viewer_profile_id;

  -- Create notification
  INSERT INTO public.circle_notifications (
    profile_id,
    type,
    title,
    message,
    actor_profile_id,
    reference_type,
    reference_id
  ) VALUES (
    v_story_owner_id,
    'story_view',
    'Novo visualizador',
    v_viewer_name || ' visualizou seu story',
    NEW.viewer_profile_id,
    'story',
    NEW.story_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_notify_story_view
  AFTER INSERT ON public.circle_story_views
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_story_view();

-- =====================================================
-- 3. Create trigger for story comment notifications
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_story_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_story_owner_id UUID;
  v_commenter_name TEXT;
BEGIN
  -- Get story owner
  SELECT profile_id INTO v_story_owner_id
  FROM public.circle_stories
  WHERE id = NEW.story_id;

  -- Don't notify if commenting on own story
  IF v_story_owner_id = NEW.profile_id THEN
    RETURN NEW;
  END IF;

  -- Get commenter name
  SELECT display_name INTO v_commenter_name
  FROM public.circle_profiles
  WHERE id = NEW.profile_id;

  -- Create notification
  INSERT INTO public.circle_notifications (
    profile_id,
    type,
    title,
    message,
    actor_profile_id,
    reference_type,
    reference_id
  ) VALUES (
    v_story_owner_id,
    'story_comment',
    'Novo comentário no story',
    v_commenter_name || ' comentou: ' || LEFT(NEW.content, 50),
    NEW.profile_id,
    'story',
    NEW.story_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_notify_story_comment
  AFTER INSERT ON public.circle_story_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_story_comment();

-- =====================================================
-- 4. RLS for story owners to delete comments on their stories
-- =====================================================
CREATE POLICY "Story owners can delete comments on their stories"
  ON public.circle_story_comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_stories s
      WHERE s.id = story_id 
      AND s.profile_id = public.get_circle_profile_id_safe()
    )
  );

-- =====================================================
-- 5. RLS for feed comments - allow post owners to delete
-- =====================================================

-- First check if policy exists for authors deleting own comments
DO $$
BEGIN
  -- Add policy for comment authors to delete their own comments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'circle_comments' 
    AND policyname = 'Authors can delete own comments'
  ) THEN
    CREATE POLICY "Authors can delete own comments"
      ON public.circle_comments FOR DELETE
      USING (profile_id = public.get_circle_profile_id_safe());
  END IF;
END $$;

-- Add policy for post owners to delete comments on their posts
CREATE POLICY "Post owners can delete comments on their posts"
  ON public.circle_comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_posts p
      WHERE p.id = post_id 
      AND p.profile_id = public.get_circle_profile_id_safe()
    )
  );