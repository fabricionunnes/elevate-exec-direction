-- Criar função para verificar se é admin do sistema principal (onboarding)
CREATE OR REPLACE FUNCTION public.is_onboarding_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id AND role = 'admin'
  )
$$;

-- Adicionar política para admins do onboarding verem portal_plans
CREATE POLICY "Onboarding admins can view all plans"
ON public.portal_plans
FOR SELECT
USING (is_onboarding_admin(auth.uid()));

-- Adicionar política para admins do onboarding verem portal_companies
CREATE POLICY "Onboarding admins can view all companies"
ON public.portal_companies
FOR SELECT
USING (is_onboarding_admin(auth.uid()));

-- Adicionar política para admins do onboarding verem portal_users
CREATE POLICY "Onboarding admins can view all portal users"
ON public.portal_users
FOR SELECT
USING (is_onboarding_admin(auth.uid()));