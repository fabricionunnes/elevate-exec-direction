-- Fix: Allow users to add participants to conversations they created or are members of
-- The issue is when creating a new conversation, the first participant isn't yet a member

-- Drop existing insert policy
DROP POLICY IF EXISTS "circle_participants_insert" ON public.circle_conversation_participants;

-- Create a helper function to check if user can add participants
CREATE OR REPLACE FUNCTION public.can_add_circle_participant(check_conversation_id uuid, check_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_current_profile_id uuid;
  v_conversation_exists boolean;
  v_is_member boolean;
  v_has_participants boolean;
BEGIN
  -- Get current user's profile id
  SELECT id INTO v_current_profile_id
  FROM public.circle_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_current_profile_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if the conversation exists
  SELECT EXISTS(SELECT 1 FROM public.circle_conversations WHERE id = check_conversation_id)
  INTO v_conversation_exists;
  
  IF NOT v_conversation_exists THEN
    RETURN false;
  END IF;
  
  -- Check if conversation has any participants yet
  SELECT EXISTS(SELECT 1 FROM public.circle_conversation_participants WHERE conversation_id = check_conversation_id)
  INTO v_has_participants;
  
  -- If no participants yet, allow adding (user is creating the conversation)
  IF NOT v_has_participants THEN
    RETURN true;
  END IF;
  
  -- Check if current user is already a member
  SELECT EXISTS(
    SELECT 1 FROM public.circle_conversation_participants 
    WHERE conversation_id = check_conversation_id AND profile_id = v_current_profile_id
  ) INTO v_is_member;
  
  -- If user is a member, they can add participants
  IF v_is_member THEN
    RETURN true;
  END IF;
  
  -- Special case: if user is adding themselves
  IF check_profile_id = v_current_profile_id THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Create new insert policy using the helper function
CREATE POLICY "circle_participants_insert" ON public.circle_conversation_participants
FOR INSERT TO authenticated
WITH CHECK (can_add_circle_participant(conversation_id, profile_id));