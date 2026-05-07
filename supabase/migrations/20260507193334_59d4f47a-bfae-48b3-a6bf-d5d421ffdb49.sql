CREATE TABLE public.agent_chat_ids (
  agent TEXT NOT NULL PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_chat_ids DISABLE ROW LEVEL SECURITY;