-- Remover políticas que causam recursão infinita
DROP POLICY IF EXISTS "Staff admins can manage all staff" ON onboarding_staff;
DROP POLICY IF EXISTS "App admins can manage staff" ON onboarding_staff;

-- Recriar política usando a função security definer que já existe
-- A função is_onboarding_admin() já é SECURITY DEFINER e não causa recursão
CREATE POLICY "Onboarding admins can manage all staff"
ON onboarding_staff
FOR ALL
USING (is_onboarding_admin());

-- Manter a política de visualização para usuários autenticados
-- (já existe "Authenticated users can view staff")