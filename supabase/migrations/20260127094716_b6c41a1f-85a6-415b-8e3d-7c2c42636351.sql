-- Create a SECURITY DEFINER function to start (or reuse) a Circle conversation safely
-- This avoids client-side INSERTs being blocked by RLS edge cases.

CREATE OR REPLACE FUNCTION public.circle_start_conversation(
  current_profile_id uuid,
  target_profile_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_current_profile uuid;
  v_existing_conversation uuid;
  v_new_conversation uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure the caller is starting the conversation as their own circle profile
  v_current_profile := public.get_circle_profile_id();
  IF v_current_profile IS NULL OR v_current_profile <> current_profile_id THEN
    RAISE EXCEPTION 'Invalid current profile';
  END IF;

  IF target_profile_id IS NULL OR target_profile_id = current_profile_id THEN
    RAISE EXCEPTION 'Invalid target profile';
  END IF;

  -- Reuse existing 1:1 conversation if it exists
  SELECT p1.conversation_id
    INTO v_existing_conversation
  FROM public.circle_conversation_participants p1
  JOIN public.circle_conversation_participants p2
    ON p2.conversation_id = p1.conversation_id
  WHERE p1.profile_id = current_profile_id
    AND p2.profile_id = target_profile_id
  LIMIT 1;

  IF v_existing_conversation IS NOT NULL THEN
    RETURN v_existing_conversation;
  END IF;

  -- Create new conversation
  INSERT INTO public.circle_conversations DEFAULT VALUES
  RETURNING id INTO v_new_conversation;

  -- Insert participants (self first)
  INSERT INTO public.circle_conversation_participants (conversation_id, profile_id)
  VALUES (v_new_conversation, current_profile_id);

  INSERT INTO public.circle_conversation_participants (conversation_id, profile_id)
  VALUES (v_new_conversation, target_profile_id);

  RETURN v_new_conversation;
END;
$$;

GRANT EXECUTE ON FUNCTION public.circle_start_conversation(uuid, uuid) TO authenticated;

-- Optional hardening: we can keep the INSERT policy as-is; function bypasses RLS anyway.
