CREATE TABLE IF NOT EXISTS public.telegram_sessions (
  chat_id BIGINT NOT NULL,
  agent_type TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, agent_type)
);

ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

-- No policies: only service role (edge functions) can access.