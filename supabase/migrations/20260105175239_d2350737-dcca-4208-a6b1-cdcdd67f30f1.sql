-- Create virtual office rooms table
CREATE TABLE public.virtual_office_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  room_type TEXT NOT NULL DEFAULT 'permanent' CHECK (room_type IN ('permanent', 'temporary')),
  meet_link TEXT,
  created_by UUID REFERENCES onboarding_staff(id),
  team_type TEXT, -- 'consultants', 'cs', 'admin', 'all'
  is_active BOOLEAN DEFAULT true,
  max_participants INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user presence table
CREATE TABLE public.virtual_office_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES onboarding_staff(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES virtual_office_rooms(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'away', 'busy', 'in_meeting', 'offline')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_activity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id)
);

-- Create chat messages table
CREATE TABLE public.virtual_office_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES virtual_office_rooms(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID REFERENCES onboarding_staff(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'file')),
  reply_to_id UUID REFERENCES virtual_office_messages(id),
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.virtual_office_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_office_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_office_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for rooms (staff can view all rooms)
CREATE POLICY "Staff can view all rooms"
  ON public.virtual_office_rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage rooms"
  ON public.virtual_office_rooms FOR ALL
  TO authenticated
  USING (public.is_onboarding_admin());

-- RLS policies for presence
CREATE POLICY "Staff can view all presence"
  ON public.virtual_office_presence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can manage own presence"
  ON public.virtual_office_presence FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM onboarding_staff os
      WHERE os.id = virtual_office_presence.staff_id
      AND os.user_id = auth.uid()
    )
  );

-- RLS policies for messages
CREATE POLICY "Staff can view room messages"
  ON public.virtual_office_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can send messages"
  ON public.virtual_office_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM onboarding_staff os
      WHERE os.id = virtual_office_messages.staff_id
      AND os.user_id = auth.uid()
    )
  );

-- Enable realtime for presence and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.virtual_office_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.virtual_office_messages;

-- Create indexes
CREATE INDEX idx_presence_staff ON virtual_office_presence(staff_id);
CREATE INDEX idx_presence_room ON virtual_office_presence(room_id);
CREATE INDEX idx_messages_room ON virtual_office_messages(room_id);
CREATE INDEX idx_messages_created ON virtual_office_messages(created_at);

-- Insert default rooms
INSERT INTO public.virtual_office_rooms (name, description, room_type, team_type) VALUES
  ('Sala Geral', 'Espaço para toda a equipe', 'permanent', 'all'),
  ('Consultores', 'Sala exclusiva dos consultores', 'permanent', 'consultants'),
  ('Customer Success', 'Sala do time de CS', 'permanent', 'cs'),
  ('Liderança', 'Sala para reuniões de gestão', 'permanent', 'admin');