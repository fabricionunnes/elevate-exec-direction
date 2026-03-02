
-- Table to configure which staff members receive payment notifications
CREATE TABLE public.payment_notification_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(staff_id)
);

-- Enable RLS
ALTER TABLE public.payment_notification_subscribers ENABLE ROW LEVEL SECURITY;

-- Policy: staff can read
CREATE POLICY "Staff can view payment notification subscribers"
  ON public.payment_notification_subscribers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Policy: admin/master can manage
CREATE POLICY "Admin can manage payment notification subscribers"
  ON public.payment_notification_subscribers
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
