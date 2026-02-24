-- Ajusta acesso de links de pagamento para equipe interna e donos dos próprios links
DROP POLICY IF EXISTS "Staff can insert payment links" ON public.payment_links;
DROP POLICY IF EXISTS "Staff can view all payment links" ON public.payment_links;
DROP POLICY IF EXISTS "Staff can update payment links" ON public.payment_links;

CREATE POLICY "Team or owner can insert payment links"
ON public.payment_links
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.get_current_staff_id() IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.portal_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.role IN ('admin_company', 'admin_unv')
    )
  )
);

CREATE POLICY "Team or owner can view payment links"
ON public.payment_links
FOR SELECT
USING (
  public.get_current_staff_id() IS NOT NULL
  OR created_by = auth.uid()
);

CREATE POLICY "Team or owner can update payment links"
ON public.payment_links
FOR UPDATE
USING (
  public.get_current_staff_id() IS NOT NULL
  OR created_by = auth.uid()
)
WITH CHECK (
  public.get_current_staff_id() IS NOT NULL
  OR created_by = auth.uid()
);

-- Ajusta visualização de ordens: equipe vê tudo, dono do link vê suas ordens vinculadas
DROP POLICY IF EXISTS "Staff can view all orders" ON public.pagarme_orders;

CREATE POLICY "Staff or link owner can view orders"
ON public.pagarme_orders
FOR SELECT
USING (
  public.get_current_staff_id() IS NOT NULL
  OR EXISTS (
    SELECT 1
    FROM public.payment_links pl
    WHERE pl.id = pagarme_orders.payment_link_id
      AND pl.created_by = auth.uid()
  )
);