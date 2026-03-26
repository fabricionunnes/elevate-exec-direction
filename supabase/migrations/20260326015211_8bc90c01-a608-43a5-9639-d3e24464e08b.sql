
ALTER TABLE public.slide_remote_sessions ADD COLUMN IF NOT EXISTS current_step integer DEFAULT 0;
