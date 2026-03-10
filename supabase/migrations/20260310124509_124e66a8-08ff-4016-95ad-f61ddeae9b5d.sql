
-- Update DELETE policy: admins can delete any, others only their own
DROP POLICY IF EXISTS "Users can delete their own presentations" ON public.slide_presentations;

CREATE POLICY "Users can delete presentations based on role"
ON public.slide_presentations
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_staff_admin_or_master(auth.uid())
);

-- Update UPDATE policy: admins can update any, others only their own
DROP POLICY IF EXISTS "Users can update their own presentations" ON public.slide_presentations;

CREATE POLICY "Users can update presentations based on role"
ON public.slide_presentations
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_staff_admin_or_master(auth.uid())
);
