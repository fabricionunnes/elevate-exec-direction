
-- Table for granular financial sub-permissions per staff member
CREATE TABLE public.staff_financial_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.onboarding_staff(id),
  UNIQUE(staff_id, permission_key)
);

-- Enable RLS
ALTER TABLE public.staff_financial_permissions ENABLE ROW LEVEL SECURITY;

-- Only admin/master can manage financial permissions
CREATE POLICY "Staff can view own financial permissions"
  ON public.staff_financial_permissions
  FOR SELECT
  TO authenticated
  USING (
    staff_id IN (
      SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true
    )
    OR public.is_financial_admin()
    OR EXISTS (
      SELECT 1 FROM public.onboarding_staff 
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'master')
    )
  );

CREATE POLICY "Admins can manage financial permissions"
  ON public.staff_financial_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff 
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff 
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'master')
    )
  );
