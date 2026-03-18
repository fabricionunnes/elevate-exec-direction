CREATE POLICY "CEO can insert tenants"
ON public.whitelabel_tenants
FOR INSERT
TO authenticated
WITH CHECK (public.is_ceo());

CREATE POLICY "CEO can delete tenants"
ON public.whitelabel_tenants
FOR DELETE
TO authenticated
USING (public.is_ceo());