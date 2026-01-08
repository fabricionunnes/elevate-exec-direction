-- Add timeout_at field to support_room_sessions
ALTER TABLE public.support_room_sessions ADD COLUMN timeout_at timestamp with time zone;