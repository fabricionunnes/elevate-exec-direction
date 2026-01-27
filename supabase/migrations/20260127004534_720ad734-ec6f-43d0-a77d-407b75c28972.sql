-- Tabela de conversas/chats entre usuários
CREATE TABLE public.circle_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now()
);

-- Participantes das conversas
CREATE TABLE public.circle_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.circle_conversations(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, profile_id)
);

-- Mensagens de chat
CREATE TABLE public.circle_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.circle_conversations(id) ON DELETE CASCADE NOT NULL,
  sender_profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Comentários em stories
CREATE TABLE public.circle_story_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.circle_stories(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stories salvos
CREATE TABLE public.circle_saved_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.circle_profiles(id) ON DELETE CASCADE NOT NULL,
  story_id UUID REFERENCES public.circle_stories(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, story_id)
);

-- Enable RLS
ALTER TABLE public.circle_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_story_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_saved_stories ENABLE ROW LEVEL SECURITY;

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_messages;

-- RLS Policies for conversations
CREATE POLICY "Users can view their conversations" ON public.circle_conversations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.circle_conversation_participants cp
    JOIN public.circle_profiles p ON p.id = cp.profile_id
    WHERE cp.conversation_id = circle_conversations.id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create conversations" ON public.circle_conversations
FOR INSERT WITH CHECK (true);

-- RLS Policies for participants
CREATE POLICY "Users can view conversation participants" ON public.circle_conversation_participants
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.circle_profiles p
    WHERE p.id = profile_id AND p.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.circle_conversation_participants cp2
    JOIN public.circle_profiles p ON p.id = cp2.profile_id
    WHERE cp2.conversation_id = circle_conversation_participants.conversation_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join conversations" ON public.circle_conversation_participants
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.circle_profiles p
    WHERE p.id = profile_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their participation" ON public.circle_conversation_participants
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.circle_profiles p
    WHERE p.id = profile_id AND p.user_id = auth.uid()
  )
);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations" ON public.circle_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.circle_conversation_participants cp
    JOIN public.circle_profiles p ON p.id = cp.profile_id
    WHERE cp.conversation_id = circle_messages.conversation_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages" ON public.circle_messages
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.circle_profiles p
    WHERE p.id = sender_profile_id AND p.user_id = auth.uid()
  )
  AND
  EXISTS (
    SELECT 1 FROM public.circle_conversation_participants cp
    JOIN public.circle_profiles p ON p.id = cp.profile_id
    WHERE cp.conversation_id = circle_messages.conversation_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own messages" ON public.circle_messages
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.circle_profiles p
    WHERE p.id = sender_profile_id AND p.user_id = auth.uid()
  )
);

-- RLS Policies for story comments
CREATE POLICY "Anyone can view story comments" ON public.circle_story_comments
FOR SELECT USING (true);

CREATE POLICY "Users can comment on stories" ON public.circle_story_comments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.circle_profiles p
    WHERE p.id = profile_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own story comments" ON public.circle_story_comments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.circle_profiles p
    WHERE p.id = profile_id AND p.user_id = auth.uid()
  )
);

-- RLS Policies for saved stories
CREATE POLICY "Users can view their saved stories" ON public.circle_saved_stories
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.circle_profiles p
    WHERE p.id = profile_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can save stories" ON public.circle_saved_stories
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.circle_profiles p
    WHERE p.id = profile_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can unsave stories" ON public.circle_saved_stories
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.circle_profiles p
    WHERE p.id = profile_id AND p.user_id = auth.uid()
  )
);

-- Function to update conversation last_message_at
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.circle_conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message
AFTER INSERT ON public.circle_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message();

-- Indexes for performance
CREATE INDEX idx_circle_messages_conversation ON public.circle_messages(conversation_id);
CREATE INDEX idx_circle_messages_sender ON public.circle_messages(sender_profile_id);
CREATE INDEX idx_circle_conversation_participants_profile ON public.circle_conversation_participants(profile_id);
CREATE INDEX idx_circle_story_comments_story ON public.circle_story_comments(story_id);