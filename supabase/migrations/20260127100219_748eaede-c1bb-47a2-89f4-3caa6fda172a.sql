-- Add media_type column to marketplace images for video support
ALTER TABLE public.circle_marketplace_images 
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video'));

-- Create a security definer function to safely get circle profile id (avoiding RLS issues)
CREATE OR REPLACE FUNCTION public.get_circle_profile_id_safe()
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

-- Drop and recreate community members INSERT policy to ensure it works
DROP POLICY IF EXISTS "Users can join communities" ON public.circle_community_members;
CREATE POLICY "Users can join communities"
  ON public.circle_community_members FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = public.get_circle_profile_id_safe());

-- Drop and recreate community members DELETE policy
DROP POLICY IF EXISTS "Users can leave communities" ON public.circle_community_members;
CREATE POLICY "Users can leave communities"
  ON public.circle_community_members FOR DELETE
  TO authenticated
  USING (profile_id = public.get_circle_profile_id_safe());

-- Fix posts INSERT policy
DROP POLICY IF EXISTS "Users can create posts" ON public.circle_posts;
CREATE POLICY "Users can create posts"
  ON public.circle_posts FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = public.get_circle_profile_id_safe());

-- Fix posts UPDATE policy
DROP POLICY IF EXISTS "Users can update own posts" ON public.circle_posts;
CREATE POLICY "Users can update own posts"
  ON public.circle_posts FOR UPDATE
  TO authenticated
  USING (profile_id = public.get_circle_profile_id_safe());

-- Fix posts DELETE policy
DROP POLICY IF EXISTS "Users can delete own posts" ON public.circle_posts;
CREATE POLICY "Users can delete own posts"
  ON public.circle_posts FOR DELETE
  TO authenticated
  USING (profile_id = public.get_circle_profile_id_safe() OR public.is_circle_admin());

-- Also fix marketplace images INSERT policy
DROP POLICY IF EXISTS "Listing owners can manage images" ON public.circle_marketplace_images;
CREATE POLICY "Listing owners can manage images"
  ON public.circle_marketplace_images FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_marketplace_listings l
      WHERE l.id = circle_marketplace_images.listing_id
      AND l.profile_id = public.get_circle_profile_id_safe()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.circle_marketplace_listings l
      WHERE l.id = circle_marketplace_images.listing_id
      AND l.profile_id = public.get_circle_profile_id_safe()
    )
  );