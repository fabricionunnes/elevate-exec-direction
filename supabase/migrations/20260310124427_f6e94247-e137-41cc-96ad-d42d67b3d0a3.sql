
-- Security definer function to check if a user is staff admin/master
CREATE OR REPLACE FUNCTION public.is_staff_admin_or_master(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = check_user_id
    AND is_active = true
    AND role IN ('admin', 'master')
  )
$$;

-- Security definer function to get staff_id for a user
CREATE OR REPLACE FUNCTION public.get_staff_id_for_user(check_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.onboarding_staff
  WHERE user_id = check_user_id
  AND is_active = true
  LIMIT 1
$$;

-- Security definer function to check if a presentation was created by an admin
CREATE OR REPLACE FUNCTION public.is_slide_created_by_admin(pres_staff_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE id = pres_staff_id
    AND is_active = true
    AND role IN ('admin', 'master')
  )
$$;

-- Drop existing SELECT policy on slide_presentations
DROP POLICY IF EXISTS "Authenticated users can view all presentations" ON public.slide_presentations;

-- New SELECT policy: admins see all, non-admins see non-admin slides + their own
CREATE POLICY "Staff can view presentations based on role"
ON public.slide_presentations
FOR SELECT
TO authenticated
USING (
  -- Admins/masters see everything
  public.is_staff_admin_or_master(auth.uid())
  OR
  -- Non-admins see: their own OR presentations NOT created by admins
  (
    created_by = auth.uid()
    OR
    (staff_id IS NOT NULL AND NOT public.is_slide_created_by_admin(staff_id))
    OR
    (staff_id IS NULL AND NOT public.is_staff_admin_or_master(created_by))
  )
);

-- Drop existing SELECT policy on slide_items
DROP POLICY IF EXISTS "Authenticated users can view slide items" ON public.slide_items;

-- New SELECT policy for slide_items: follows same logic via presentation
CREATE POLICY "Staff can view slide items based on role"
ON public.slide_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.slide_presentations sp
    WHERE sp.id = slide_items.presentation_id
  )
);
