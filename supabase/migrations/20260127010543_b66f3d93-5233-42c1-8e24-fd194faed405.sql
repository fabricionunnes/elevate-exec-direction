-- Fix infinite recursion in Circle messaging RLS by removing recursive policies
-- and using SECURITY DEFINER functions with row_security disabled.

BEGIN;

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE IF EXISTS public.circle_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.circle_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.circle_messages ENABLE ROW LEVEL SECURITY;

-- Drop ALL known/legacy policies that may cause recursion or conflicts
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('circle_conversation_participants','circle_conversations','circle_messages')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Helper: get current circle profile id for logged in user
CREATE OR REPLACE FUNCTION public.get_circle_profile_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN (
    SELECT id
    FROM public.circle_profiles
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- Helper: check if a profile participates in a conversation (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_circle_conversation_member(check_conversation_id uuid, check_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.circle_conversation_participants
    WHERE conversation_id = check_conversation_id
      AND profile_id = check_profile_id
  );
END;
$$;

-- Policies (minimal and non-recursive)
-- Participants: can view rows if they are the participant OR if they are member of that conversation
CREATE POLICY "circle_participants_select"
ON public.circle_conversation_participants
FOR SELECT
TO authenticated
USING (
  profile_id = public.get_circle_profile_id()
  OR public.is_circle_conversation_member(conversation_id, public.get_circle_profile_id())
);

-- Participants: can insert their own participation; can also insert other participants only
-- after they are already a member (app will insert self first, then the other)
CREATE POLICY "circle_participants_insert"
ON public.circle_conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  profile_id = public.get_circle_profile_id()
  OR public.is_circle_conversation_member(conversation_id, public.get_circle_profile_id())
);

-- Conversations: members can view
CREATE POLICY "circle_conversations_select"
ON public.circle_conversations
FOR SELECT
TO authenticated
USING (
  public.is_circle_conversation_member(id, public.get_circle_profile_id())
);

-- Conversations: any authenticated user can create (participants are controlled separately)
CREATE POLICY "circle_conversations_insert"
ON public.circle_conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Messages: members can view
CREATE POLICY "circle_messages_select"
ON public.circle_messages
FOR SELECT
TO authenticated
USING (
  public.is_circle_conversation_member(conversation_id, public.get_circle_profile_id())
);

-- Messages: only members can send and must be sender
CREATE POLICY "circle_messages_insert"
ON public.circle_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_profile_id = public.get_circle_profile_id()
  AND public.is_circle_conversation_member(conversation_id, public.get_circle_profile_id())
);

COMMIT;