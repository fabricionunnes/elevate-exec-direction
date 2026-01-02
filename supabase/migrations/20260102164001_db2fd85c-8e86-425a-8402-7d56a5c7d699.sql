-- Corrigir política RLS para onboarding_staff
-- A política atual usa onboarding_users, mas deveria usar onboarding_staff

-- Remover política antiga que não funciona corretamente
DROP POLICY IF EXISTS "Admins can manage staff" ON onboarding_staff;

-- Criar nova política que permite admins do onboarding_staff gerenciar outros membros
CREATE POLICY "Staff admins can manage all staff"
ON onboarding_staff
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND is_active = true
  )
);

-- Também permitir que usuários admin da app_role possam gerenciar
CREATE POLICY "App admins can manage staff"
ON onboarding_staff
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);