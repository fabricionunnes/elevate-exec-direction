-- Drop the broken policy
DROP POLICY IF EXISTS "Clients can create support sessions" ON public.support_room_sessions;

-- Create corrected policy - clients can insert sessions for themselves
CREATE POLICY "Clients can create support sessions"
ON public.support_room_sessions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.id = support_room_sessions.user_id
  )
);

-- Also fix the client update policy to allow them to cancel their own sessions
CREATE POLICY "Clients can update their own sessions"
ON public.support_room_sessions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.id = support_room_sessions.user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.id = support_room_sessions.user_id
  )
);