-- Allow active staff (including master) to view orders in recebimentos
DROP POLICY IF EXISTS "Admins can view all orders" ON public.pagarme_orders;

CREATE POLICY "Staff can view all orders"
ON public.pagarme_orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
      AND onboarding_staff.is_active = true
  )
);