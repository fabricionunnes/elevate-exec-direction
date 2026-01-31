-- Drop and recreate the client policy with correct role
DROP POLICY IF EXISTS "Clients access own project instances" ON whatsapp_instances;

CREATE POLICY "Clients access own project instances"
ON whatsapp_instances
FOR ALL
TO authenticated
USING (
  (project_id IS NOT NULL) AND 
  (EXISTS (
    SELECT 1 FROM onboarding_users ou
    WHERE ou.user_id = auth.uid() 
      AND ou.project_id = whatsapp_instances.project_id 
      AND ou.role IN ('client', 'gerente')
  ))
)
WITH CHECK (
  (project_id IS NOT NULL) AND 
  (EXISTS (
    SELECT 1 FROM onboarding_users ou
    WHERE ou.user_id = auth.uid() 
      AND ou.project_id = whatsapp_instances.project_id 
      AND ou.role IN ('client', 'gerente')
  ))
);