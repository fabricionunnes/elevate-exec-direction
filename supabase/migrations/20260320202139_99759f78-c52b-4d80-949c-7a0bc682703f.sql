
-- Allow staff to read chat messages for any project
CREATE POLICY "Staff can read chat messages"
ON public.onboarding_ai_chat
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  )
);

-- Allow staff to insert chat messages
CREATE POLICY "Staff can insert chat messages"
ON public.onboarding_ai_chat
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  )
);

-- Allow onboarding users to read their project's chat messages
CREATE POLICY "Users can read own project chat"
ON public.onboarding_ai_chat
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users u
    WHERE u.user_id = auth.uid() AND u.project_id = onboarding_ai_chat.project_id
  )
);

-- Allow onboarding users to insert messages in their project
CREATE POLICY "Users can insert own project chat"
ON public.onboarding_ai_chat
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_users u
    WHERE u.user_id = auth.uid() AND u.project_id = onboarding_ai_chat.project_id
  )
);
