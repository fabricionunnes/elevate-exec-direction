-- Corrige o isolamento do discador para usar os helpers CANÔNICOS da plataforma
-- (is_master_user / current_user_tenant_id), idêntico ao crm_leads. Substitui o RLS do incremento 3.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crm_dialer_campaigns','crm_dialer_queue','crm_calls','crm_dialer_sessions',
    'dialer_wallets','dialer_ledger','dialer_recharges'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_scope_'||t, t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR ALL
      USING (
        CASE
          WHEN public.is_master_user() THEN (tenant_id IS NULL)
          WHEN public.current_user_tenant_id() IS NOT NULL THEN (tenant_id = public.current_user_tenant_id())
          ELSE true
        END
      )
      WITH CHECK (
        CASE
          WHEN public.is_master_user() THEN (tenant_id IS NULL)
          WHEN public.current_user_tenant_id() IS NOT NULL THEN ((tenant_id = public.current_user_tenant_id()) OR (tenant_id IS NULL))
          ELSE true
        END
      )
    $f$, 'tenant_scope_'||t, t);
  END LOOP;
END $$;

-- helper próprio não é mais usado
DROP FUNCTION IF EXISTS public.dialer_current_tenant();
