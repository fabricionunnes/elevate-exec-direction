-- Remover políticas antigas
DROP POLICY IF EXISTS "Admins can insert instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Admins can update instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Admins can delete instances" ON whatsapp_instances;

-- Criar novas políticas incluindo master
CREATE POLICY "Admins and masters can insert instances" 
ON whatsapp_instances FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
    AND onboarding_staff.role IN ('admin', 'master')
  )
);

CREATE POLICY "Admins and masters can update instances" 
ON whatsapp_instances FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
    AND onboarding_staff.role IN ('admin', 'master')
  )
);

CREATE POLICY "Admins and masters can delete instances" 
ON whatsapp_instances FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
    AND onboarding_staff.role IN ('admin', 'master')
  )
);