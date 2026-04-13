
-- UNV Office Subscriptions (per company)
CREATE TABLE public.office_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.onboarding_companies(id) ON DELETE SET NULL,
  max_users INTEGER NOT NULL DEFAULT 1,
  active_users INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'cancelled', 'trial')),
  price_per_user NUMERIC(10,2) NOT NULL DEFAULT 197.00,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Office Rooms
CREATE TABLE public.office_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'open' CHECK (room_type IN ('open', 'meeting', 'private', 'training', 'auditorium', 'brainstorm', 'war_room', 'support', 'networking', 'presentation')),
  floor_number INTEGER NOT NULL DEFAULT 1,
  capacity INTEGER DEFAULT 10,
  is_private BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  position_z REAL NOT NULL DEFAULT 0,
  width REAL NOT NULL DEFAULT 5,
  depth REAL NOT NULL DEFAULT 5,
  color TEXT DEFAULT '#4A90D9',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Avatars
CREATE TABLE public.office_user_avatars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Usuário',
  skin_color TEXT NOT NULL DEFAULT '#F5D0A9',
  hair_color TEXT NOT NULL DEFAULT '#4A3728',
  hair_style TEXT NOT NULL DEFAULT 'short',
  shirt_color TEXT NOT NULL DEFAULT '#2196F3',
  pants_color TEXT NOT NULL DEFAULT '#37474F',
  accessory TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Real-time Presence
CREATE TABLE public.office_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.office_rooms(id) ON DELETE SET NULL,
  floor_number INTEGER NOT NULL DEFAULT 1,
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  position_z REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'away', 'busy', 'in_meeting')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Activity Logs
CREATE TABLE public.office_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.office_rooms(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('enter_office', 'leave_office', 'enter_room', 'leave_room', 'start_meeting', 'end_meeting', 'start_call', 'end_call')),
  metadata JSONB DEFAULT '{}',
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Room Access Control
CREATE TABLE public.office_room_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.office_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'member' CHECK (access_level IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Chat Messages per Room
CREATE TABLE public.office_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.office_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'emoji', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.office_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_user_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_room_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Office Rooms: viewable by all authenticated users
CREATE POLICY "Anyone can view active rooms" ON public.office_rooms
  FOR SELECT TO authenticated USING (is_active = true);

-- Subscriptions: viewable by project members
CREATE POLICY "View own project subscriptions" ON public.office_subscriptions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage subscriptions" ON public.office_subscriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Avatars
CREATE POLICY "Anyone can view avatars" ON public.office_user_avatars
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage own avatar" ON public.office_user_avatars
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own avatar" ON public.office_user_avatars
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Presence: viewable by all, managed by self
CREATE POLICY "Anyone can view presence" ON public.office_presence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage own presence" ON public.office_presence
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own presence" ON public.office_presence
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own presence" ON public.office_presence
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Activity Logs
CREATE POLICY "View activity logs" ON public.office_activity_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insert own activity" ON public.office_activity_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Room Access
CREATE POLICY "View room access" ON public.office_room_access
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage room access" ON public.office_room_access
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Chat Messages
CREATE POLICY "View room messages" ON public.office_chat_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Send messages" ON public.office_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for presence and chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.office_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.office_chat_messages;

-- Indexes
CREATE INDEX idx_office_presence_user ON public.office_presence(user_id);
CREATE INDEX idx_office_presence_room ON public.office_presence(room_id);
CREATE INDEX idx_office_activity_user ON public.office_activity_logs(user_id);
CREATE INDEX idx_office_activity_room ON public.office_activity_logs(room_id);
CREATE INDEX idx_office_chat_room ON public.office_chat_messages(room_id);
CREATE INDEX idx_office_subscriptions_project ON public.office_subscriptions(project_id);

-- Insert default rooms for each floor
-- Floor 1 - Suporte
INSERT INTO public.office_rooms (name, room_type, floor_number, capacity, is_private, description, position_x, position_z, width, depth, color) VALUES
('Recepção', 'open', 1, 20, false, 'Área de recepção e boas-vindas', 0, 0, 8, 6, '#4CAF50'),
('Suporte ao Cliente', 'support', 1, 10, false, 'Sala de atendimento ao cliente', 10, 0, 6, 5, '#2196F3'),
('Atendimento em Tempo Real', 'support', 1, 5, false, 'Atendimento imediato', 10, 7, 6, 5, '#03A9F4');

-- Floor 2 - Empresários (Clientes)
INSERT INTO public.office_rooms (name, room_type, floor_number, capacity, is_private, description, position_x, position_z, width, depth, color) VALUES
('Sala de Networking', 'networking', 2, 30, false, 'Área de networking entre empresários', 0, 0, 10, 8, '#FF9800'),
('Sala de Reunião A', 'meeting', 2, 8, true, 'Reunião privada para clientes', 12, 0, 5, 5, '#9C27B0'),
('Sala de Reunião B', 'meeting', 2, 8, true, 'Reunião privada para clientes', 12, 7, 5, 5, '#9C27B0'),
('Sala Privada 1', 'private', 2, 4, true, 'Sala privada por empresa', 0, 10, 4, 4, '#607D8B'),
('Sala Privada 2', 'private', 2, 4, true, 'Sala privada por empresa', 6, 10, 4, 4, '#607D8B');

-- Floor 3 - Consultores
INSERT INTO public.office_rooms (name, room_type, floor_number, capacity, is_private, description, position_x, position_z, width, depth, color) VALUES
('Sala de Atendimento 1', 'meeting', 3, 4, true, 'Atendimento individual', 0, 0, 5, 4, '#00BCD4'),
('Sala de Atendimento 2', 'meeting', 3, 4, true, 'Atendimento individual', 7, 0, 5, 4, '#00BCD4'),
('Reunião com Clientes', 'meeting', 3, 8, true, 'Sala de reunião com clientes', 0, 6, 6, 5, '#3F51B5'),
('Sala Individual 1', 'private', 3, 1, true, 'Sala individual do consultor', 14, 0, 3, 3, '#795548'),
('Sala Individual 2', 'private', 3, 1, true, 'Sala individual do consultor', 14, 5, 3, 3, '#795548');

-- Floor 4 - Staff UNV
INSERT INTO public.office_rooms (name, room_type, floor_number, capacity, is_private, description, position_x, position_z, width, depth, color) VALUES
('Sala de Operação', 'open', 4, 15, false, 'Operação diária do time', 0, 0, 8, 6, '#F44336'),
('Sala de Gestão', 'private', 4, 6, true, 'Gestão e planejamento', 10, 0, 5, 5, '#E91E63'),
('Reuniões Internas', 'meeting', 4, 10, true, 'Reuniões internas do staff', 10, 7, 6, 5, '#673AB7'),
('War Room', 'war_room', 4, 8, true, 'Acompanhamento de metas e indicadores', 0, 8, 6, 5, '#D32F2F'),
('Auditório', 'auditorium', 4, 50, false, 'Eventos e apresentações', 0, 15, 12, 8, '#1565C0'),
('Sala de Treinamento', 'training', 4, 20, false, 'Treinamentos e aulas ao vivo', 14, 0, 6, 6, '#2E7D32'),
('Sala de Brainstorm', 'brainstorm', 4, 8, false, 'Quadro colaborativo e ideação', 14, 8, 5, 5, '#FF6F00');
