-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Staff can create form links" ON public.culture_form_links;

-- Create a proper INSERT policy that allows authenticated staff to create form links
CREATE POLICY "Staff can create form links"
ON public.culture_form_links
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.role IN ('master', 'admin', 'consultant', 'cs', 'rh')
  )
);

-- Also ensure SELECT policy exists for staff
DROP POLICY IF EXISTS "Staff can view form links" ON public.culture_form_links;
CREATE POLICY "Staff can view form links"
ON public.culture_form_links
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
  )
);

-- And UPDATE policy for staff
DROP POLICY IF EXISTS "Staff can update form links" ON public.culture_form_links;
CREATE POLICY "Staff can update form links"
ON public.culture_form_links
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.role IN ('master', 'admin', 'consultant', 'cs', 'rh')
  )
);