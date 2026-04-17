ALTER TABLE public.whitelabel_tenants
  ADD COLUMN IF NOT EXISTS max_users integer;

COMMENT ON COLUMN public.whitelabel_tenants.max_users IS
  'Override manual do limite de usuários do tenant. Quando NULL, usa whitelabel_plans.max_users do plano vinculado.';