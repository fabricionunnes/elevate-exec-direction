-- First create the helper functions
CREATE OR REPLACE FUNCTION public.get_circle_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.circle_profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_circle_conversation_member(check_conversation_id uuid, check_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_conversation_participants
    WHERE conversation_id = check_conversation_id
    AND profile_id = check_profile_id
  )
$$;

-- Now create the policies
CREATE POLICY "Participants can view"
ON public.circle_conversation_participants
FOR SELECT
USING (
  profile_id = public.get_circle_profile_id()
  OR public.is_circle_conversation_member(conversation_id, public.get_circle_profile_id())
);

CREATE POLICY "Participants can insert"
ON public.circle_conversation_participants
FOR INSERT
WITH CHECK (
  profile_id = public.get_circle_profile_id()
  OR public.is_circle_conversation_member(conversation_id, public.get_circle_profile_id())
);

CREATE POLICY "View own conversations"
ON public.circle_conversations
FOR SELECT
USING (
  public.is_circle_conversation_member(id, public.get_circle_profile_id())
);

CREATE POLICY "Create conversations"
ON public.circle_conversations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "View conversation messages"
ON public.circle_messages
FOR SELECT
USING (
  public.is_circle_conversation_member(conversation_id, public.get_circle_profile_id())
);

CREATE POLICY "Send messages"
ON public.circle_messages
FOR INSERT
WITH CHECK (
  sender_profile_id = public.get_circle_profile_id()
  AND public.is_circle_conversation_member(conversation_id, public.get_circle_profile_id())
);