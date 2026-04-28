-- Restrict whatsapp_instances SELECT for non-admin staff to only authorized instances

DROP POLICY IF EXISTS "Staff can view instances" ON public.whatsapp_instances;
DROP POLICY IF EXISTS "Staff can manage all instances" ON public.whatsapp_instances;

-- Admin and master: full read access
CREATE POLICY "Admins and masters can view all instances"
ON public.whatsapp_instances
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
      AND os.is_active = true
      AND os.role IN ('admin', 'master')
  )
);

-- Other staff: only instances they have explicit access to
CREATE POLICY "Staff can view authorized instances"
ON public.whatsapp_instances
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_instance_access wia
    JOIN public.onboarding_staff os ON os.id = wia.staff_id
    WHERE os.user_id = auth.uid()
      AND os.is_active = true
      AND wia.instance_id = whatsapp_instances.id
      AND wia.can_view = true
  )
);

-- Restore admin/master ALL management (without the project_id IS NULL loophole)
CREATE POLICY "Admins and masters can manage instances"
ON public.whatsapp_instances
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
      AND os.is_active = true
      AND os.role IN ('admin', 'master')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid()
      AND os.is_active = true
      AND os.role IN ('admin', 'master')
  )
);