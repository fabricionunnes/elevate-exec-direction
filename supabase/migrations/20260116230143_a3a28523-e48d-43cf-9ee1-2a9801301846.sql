-- Create client board sessions table (similar to ceo_board_sessions but for projects)
CREATE TABLE public.client_board_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  decision_title TEXT NOT NULL,
  decision_description TEXT NOT NULL,
  board_summary TEXT,
  consensus_points TEXT[],
  divergence_points TEXT[],
  critical_risks TEXT[],
  opportunities TEXT[],
  final_recommendation TEXT,
  context_data JSONB,
  status TEXT DEFAULT 'pending',
  ceo_decision TEXT,
  ceo_notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create client board opinions table
CREATE TABLE public.client_board_opinions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.client_board_sessions(id) ON DELETE CASCADE,
  advisor_role TEXT NOT NULL,
  advisor_name TEXT NOT NULL,
  opinion TEXT NOT NULL,
  risks TEXT[],
  opportunities TEXT[],
  suggested_adjustments TEXT[],
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_board_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_board_opinions ENABLE ROW LEVEL SECURITY;

-- Policies for client_board_sessions (staff can manage, more restrictive than CEO tables)
CREATE POLICY "Staff can view all client board sessions"
  ON public.client_board_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "Staff can create client board sessions"
  ON public.client_board_sessions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff can update client board sessions"
  ON public.client_board_sessions
  FOR UPDATE
  USING (true);

CREATE POLICY "Staff can delete client board sessions"
  ON public.client_board_sessions
  FOR DELETE
  USING (true);

-- Policies for client_board_opinions
CREATE POLICY "Staff can view all client board opinions"
  ON public.client_board_opinions
  FOR SELECT
  USING (true);

CREATE POLICY "Staff can create client board opinions"
  ON public.client_board_opinions
  FOR INSERT
  WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_client_board_sessions_updated_at
  BEFORE UPDATE ON public.client_board_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX idx_client_board_sessions_project_id ON public.client_board_sessions(project_id);
CREATE INDEX idx_client_board_opinions_session_id ON public.client_board_opinions(session_id);

COMMENT ON TABLE public.client_board_sessions IS 'Virtual board sessions for client projects - allows strategic decision analysis';
COMMENT ON TABLE public.client_board_opinions IS 'Individual advisor opinions for client board sessions';