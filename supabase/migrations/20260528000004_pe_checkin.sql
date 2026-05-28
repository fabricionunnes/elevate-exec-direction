ALTER TABLE public.pe_lessons
  ADD COLUMN IF NOT EXISTS checkin_code       TEXT,
  ADD COLUMN IF NOT EXISTS min_watch_minutes  INTEGER NOT NULL DEFAULT 0;
