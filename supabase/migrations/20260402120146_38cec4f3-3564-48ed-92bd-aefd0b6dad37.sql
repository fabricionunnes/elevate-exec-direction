
-- Allow client users to view their own project's Instagram account
CREATE POLICY "Clients can view own project instagram accounts"
ON public.social_instagram_accounts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = social_instagram_accounts.project_id
  )
);

-- Allow client users to insert Instagram accounts for their own project
CREATE POLICY "Clients can insert own project instagram accounts"
ON public.social_instagram_accounts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = social_instagram_accounts.project_id
  )
);

-- Allow client users to update their own project's Instagram account
CREATE POLICY "Clients can update own project instagram accounts"
ON public.social_instagram_accounts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = social_instagram_accounts.project_id
  )
);

-- Allow client users to view their own project's social integrations
CREATE POLICY "Clients can view own project integrations"
ON public.social_integrations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = social_integrations.project_id
  )
);

-- Allow client users to insert social integrations for their own project
CREATE POLICY "Clients can insert own project integrations"
ON public.social_integrations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = social_integrations.project_id
  )
);

-- Allow client users to update their own project's social integrations
CREATE POLICY "Clients can update own project integrations"
ON public.social_integrations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = social_integrations.project_id
  )
);
