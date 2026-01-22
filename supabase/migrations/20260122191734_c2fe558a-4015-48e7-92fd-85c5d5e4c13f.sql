-- Allow users to read their own onboarding_users record by auth.uid()
-- This is needed for login verification before the app knows the user's role
CREATE POLICY "Users can read their own record"
ON public.onboarding_users FOR SELECT
USING (user_id = auth.uid());