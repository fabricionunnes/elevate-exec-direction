-- Add policy for users to read their own permissions
-- The user_id in client_user_permissions references onboarding_users.id (not auth.users.id)

CREATE POLICY "Users can read their own permissions"
ON public.client_user_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.id = client_user_permissions.user_id
    AND ou.user_id = auth.uid()
  )
);