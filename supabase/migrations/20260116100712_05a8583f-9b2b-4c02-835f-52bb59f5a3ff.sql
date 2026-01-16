
-- Create table for board sessions
CREATE TABLE public.ceo_board_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_title TEXT NOT NULL,
  decision_description TEXT NOT NULL,
  context_data JSONB DEFAULT '{}',
  consensus_points TEXT[] DEFAULT '{}',
  divergence_points TEXT[] DEFAULT '{}',
  critical_risks TEXT[] DEFAULT '{}',
  opportunities TEXT[] DEFAULT '{}',
  board_summary TEXT,
  final_recommendation TEXT,
  ceo_decision TEXT CHECK (ceo_decision IN ('aprovada', 'ajustada', 'rejeitada')),
  ceo_notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for individual advisor opinions
CREATE TABLE public.ceo_board_opinions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.ceo_board_sessions(id) ON DELETE CASCADE NOT NULL,
  advisor_role TEXT NOT NULL,
  advisor_name TEXT NOT NULL,
  opinion TEXT NOT NULL,
  risks TEXT[] DEFAULT '{}',
  opportunities TEXT[] DEFAULT '{}',
  suggested_adjustments TEXT[] DEFAULT '{}',
  recommendation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ceo_board_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_board_opinions ENABLE ROW LEVEL SECURITY;

-- RLS for ceo_board_sessions - only fabricio@universidadevendas.com.br
CREATE POLICY "Only CEO can access board sessions"
ON public.ceo_board_sessions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'fabricio@universidadevendas.com.br'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'fabricio@universidadevendas.com.br'
  )
);

-- RLS for ceo_board_opinions - only fabricio@universidadevendas.com.br
CREATE POLICY "Only CEO can access board opinions"
ON public.ceo_board_opinions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'fabricio@universidadevendas.com.br'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'fabricio@universidadevendas.com.br'
  )
);

-- Create indexes
CREATE INDEX idx_board_sessions_status ON public.ceo_board_sessions(status);
CREATE INDEX idx_board_sessions_created ON public.ceo_board_sessions(created_at DESC);
CREATE INDEX idx_board_opinions_session ON public.ceo_board_opinions(session_id);
