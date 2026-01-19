-- Create table for board chat messages
CREATE TABLE public.ceo_board_chat (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.ceo_board_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'advisor')),
  advisor_role TEXT,
  advisor_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ceo_board_chat ENABLE ROW LEVEL SECURITY;

-- RLS policies - only CEO can access
CREATE POLICY "CEO can view board chat" ON public.ceo_board_chat
  FOR SELECT USING (public.is_ceo());

CREATE POLICY "CEO can insert board chat" ON public.ceo_board_chat
  FOR INSERT WITH CHECK (public.is_ceo());

-- Add index for faster queries
CREATE INDEX idx_ceo_board_chat_session_id ON public.ceo_board_chat(session_id);
CREATE INDEX idx_ceo_board_chat_created_at ON public.ceo_board_chat(created_at);