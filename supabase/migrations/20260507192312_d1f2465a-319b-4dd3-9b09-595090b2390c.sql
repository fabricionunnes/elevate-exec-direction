CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  chat_id bigint NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_messages_agent_chat_created
  ON public.agent_messages (agent, chat_id, created_at DESC);

ALTER TABLE public.agent_messages DISABLE ROW LEVEL SECURITY;