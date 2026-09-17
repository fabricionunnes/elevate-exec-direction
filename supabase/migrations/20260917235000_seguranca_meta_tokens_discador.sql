-- Segurança 17/09/2026: tokens do Meta Ads estavam legíveis e alteráveis sem login.
-- Só funções do servidor (service role) usam esta tabela; nenhuma tela lê direto.
drop policy if exists "Allow all operations" on public.unv_meta_ads_accounts;
drop policy if exists "Full access" on public.unv_meta_ads_accounts;
drop policy if exists "Anon can read connection status" on public.unv_meta_ads_accounts;
drop policy if exists "Anon can read" on public.unv_meta_ads_accounts;
revoke all on public.unv_meta_ads_accounts from anon, authenticated;

-- Segurança 17/09/2026: tabelas do discador abriam pra quem não tem login (CASE ... ELSE true).
-- O ELSE passa a exigir staff ativo; master e tenants do discador seguem iguais.
alter policy tenant_scope_crm_calls on public.crm_calls using (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_dialer_tenant_id() IS NOT NULL) THEN (tenant_id = current_user_dialer_tenant_id())
    ELSE (get_current_staff_id() IS NOT NULL)
END) with check (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_dialer_tenant_id() IS NOT NULL) THEN ((tenant_id = current_user_dialer_tenant_id()) OR (tenant_id IS NULL))
    ELSE (get_current_staff_id() IS NOT NULL)
END);
alter policy tenant_scope_crm_dialer_campaigns on public.crm_dialer_campaigns using (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_dialer_tenant_id() IS NOT NULL) THEN (tenant_id = current_user_dialer_tenant_id())
    ELSE (get_current_staff_id() IS NOT NULL)
END) with check (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_dialer_tenant_id() IS NOT NULL) THEN ((tenant_id = current_user_dialer_tenant_id()) OR (tenant_id IS NULL))
    ELSE (get_current_staff_id() IS NOT NULL)
END);
alter policy tenant_scope_crm_dialer_queue on public.crm_dialer_queue using (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_dialer_tenant_id() IS NOT NULL) THEN (tenant_id = current_user_dialer_tenant_id())
    ELSE (get_current_staff_id() IS NOT NULL)
END) with check (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_dialer_tenant_id() IS NOT NULL) THEN ((tenant_id = current_user_dialer_tenant_id()) OR (tenant_id IS NULL))
    ELSE (get_current_staff_id() IS NOT NULL)
END);
alter policy tenant_scope_crm_dialer_sessions on public.crm_dialer_sessions using (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_dialer_tenant_id() IS NOT NULL) THEN (tenant_id = current_user_dialer_tenant_id())
    ELSE (get_current_staff_id() IS NOT NULL)
END) with check (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_dialer_tenant_id() IS NOT NULL) THEN ((tenant_id = current_user_dialer_tenant_id()) OR (tenant_id IS NULL))
    ELSE (get_current_staff_id() IS NOT NULL)
END);
alter policy tenant_scope_dialer_api_keys on public.dialer_api_keys using (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_tenant_id() IS NOT NULL) THEN (tenant_id = current_user_tenant_id())
    ELSE (get_current_staff_id() IS NOT NULL)
END) with check (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_tenant_id() IS NOT NULL) THEN ((tenant_id = current_user_tenant_id()) OR (tenant_id IS NULL))
    ELSE (get_current_staff_id() IS NOT NULL)
END);
alter policy tenant_scope_dialer_billing on public.dialer_billing using (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_tenant_id() IS NOT NULL) THEN (tenant_id = current_user_tenant_id())
    ELSE (get_current_staff_id() IS NOT NULL)
END) with check (true);
alter policy tenant_scope_dialer_ledger on public.dialer_ledger using (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_tenant_id() IS NOT NULL) THEN (tenant_id = current_user_tenant_id())
    ELSE (get_current_staff_id() IS NOT NULL)
END) with check (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_tenant_id() IS NOT NULL) THEN ((tenant_id = current_user_tenant_id()) OR (tenant_id IS NULL))
    ELSE (get_current_staff_id() IS NOT NULL)
END);
alter policy tenant_scope_dialer_recharges on public.dialer_recharges using (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_tenant_id() IS NOT NULL) THEN (tenant_id = current_user_tenant_id())
    ELSE (get_current_staff_id() IS NOT NULL)
END) with check (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_tenant_id() IS NOT NULL) THEN ((tenant_id = current_user_tenant_id()) OR (tenant_id IS NULL))
    ELSE (get_current_staff_id() IS NOT NULL)
END);
alter policy tenant_scope_dialer_wallets on public.dialer_wallets using (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_tenant_id() IS NOT NULL) THEN (tenant_id = current_user_tenant_id())
    ELSE (get_current_staff_id() IS NOT NULL)
END) with check (
CASE
    WHEN is_master_user() THEN (tenant_id IS NULL)
    WHEN (current_user_tenant_id() IS NOT NULL) THEN ((tenant_id = current_user_tenant_id()) OR (tenant_id IS NULL))
    ELSE (get_current_staff_id() IS NOT NULL)
END);
