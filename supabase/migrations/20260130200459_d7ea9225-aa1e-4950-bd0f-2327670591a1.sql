-- =============================================
-- INSTAGRAM INTEGRATION TABLES
-- =============================================

-- Instagram connected accounts/instances
CREATE TABLE public.instagram_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  instagram_account_id TEXT NOT NULL UNIQUE,
  instagram_username TEXT,
  page_id TEXT NOT NULL,
  page_name TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  profile_picture_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'expired')),
  connected_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instagram instance access (similar to WhatsApp)
CREATE TABLE public.instagram_instance_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instagram_instances(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_reply BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(instance_id, staff_id)
);

-- Instagram contacts (followers, people who messaged)
CREATE TABLE public.instagram_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_user_id TEXT NOT NULL,
  instance_id UUID REFERENCES public.instagram_instances(id) ON DELETE CASCADE,
  username TEXT,
  name TEXT,
  profile_picture_url TEXT,
  is_follower BOOLEAN DEFAULT false,
  followed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(instagram_user_id, instance_id)
);

-- Instagram conversations
CREATE TABLE public.instagram_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES public.instagram_instances(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.instagram_contacts(id) ON DELETE CASCADE,
  thread_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
  assigned_to UUID REFERENCES public.onboarding_staff(id),
  lead_id UUID REFERENCES public.crm_leads(id),
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(instance_id, contact_id)
);

-- Instagram messages
CREATE TABLE public.instagram_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.instagram_conversations(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'story_reply', 'story_mention', 'share', 'like')),
  content TEXT,
  media_url TEXT,
  story_url TEXT,
  is_reaction BOOLEAN DEFAULT false,
  reaction_emoji TEXT,
  sent_by UUID REFERENCES public.onboarding_staff(id),
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instagram new followers tracking
CREATE TABLE public.instagram_follower_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instagram_instances(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.instagram_contacts(id),
  instagram_user_id TEXT NOT NULL,
  username TEXT,
  name TEXT,
  profile_picture_url TEXT,
  event_type TEXT NOT NULL DEFAULT 'follow' CHECK (event_type IN ('follow', 'unfollow')),
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instagram_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_instance_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_follower_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view instagram instances they have access to"
ON public.instagram_instances FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND (
      os.role = 'master'
      OR EXISTS (
        SELECT 1 FROM public.instagram_instance_access ia
        WHERE ia.instance_id = instagram_instances.id
        AND ia.staff_id = os.id
        AND ia.can_view = true
      )
    )
  )
);

CREATE POLICY "Master can manage instagram instances"
ON public.instagram_instances FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true AND os.role = 'master'
  )
);

CREATE POLICY "Staff can view their instagram access"
ON public.instagram_instance_access FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND (os.role = 'master' OR os.id = staff_id)
  )
);

CREATE POLICY "Master can manage instagram access"
ON public.instagram_instance_access FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true AND os.role = 'master'
  )
);

CREATE POLICY "Staff can view instagram contacts"
ON public.instagram_contacts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can manage instagram contacts"
ON public.instagram_contacts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can view instagram conversations they have access to"
ON public.instagram_conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND (
      os.role = 'master'
      OR EXISTS (
        SELECT 1 FROM public.instagram_instance_access ia
        WHERE ia.instance_id = instagram_conversations.instance_id
        AND ia.staff_id = os.id
        AND ia.can_view = true
      )
    )
  )
);

CREATE POLICY "Staff can manage instagram conversations"
ON public.instagram_conversations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can view instagram messages"
ON public.instagram_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can manage instagram messages"
ON public.instagram_messages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can view instagram follower events"
ON public.instagram_follower_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can manage instagram follower events"
ON public.instagram_follower_events FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Indexes for performance
CREATE INDEX idx_instagram_messages_conversation ON public.instagram_messages(conversation_id);
CREATE INDEX idx_instagram_messages_timestamp ON public.instagram_messages(timestamp DESC);
CREATE INDEX idx_instagram_conversations_instance ON public.instagram_conversations(instance_id);
CREATE INDEX idx_instagram_conversations_last_message ON public.instagram_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_instagram_contacts_instance ON public.instagram_contacts(instance_id);
CREATE INDEX idx_instagram_follower_events_instance ON public.instagram_follower_events(instance_id);

-- Enable realtime for conversations and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_follower_events;

-- Triggers for updated_at
CREATE TRIGGER update_instagram_instances_updated_at
BEFORE UPDATE ON public.instagram_instances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instagram_contacts_updated_at
BEFORE UPDATE ON public.instagram_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instagram_conversations_updated_at
BEFORE UPDATE ON public.instagram_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();