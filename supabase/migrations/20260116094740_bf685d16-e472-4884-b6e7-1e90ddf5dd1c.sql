-- Create table for CEO AI recommendations
CREATE TABLE public.ceo_ai_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insight TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('critico', 'importante', 'oportunidade')),
  type VARCHAR(50) NOT NULL CHECK (type IN ('insight', 'sugestao', 'alerta')),
  area VARCHAR(50),
  data_sources TEXT[],
  suggested_action TEXT,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'executada', 'ignorada', 'em_analise')),
  executed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ceo_ai_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Only CEO can access
CREATE POLICY "CEO can view recommendations"
ON public.ceo_ai_recommendations
FOR SELECT
USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO can insert recommendations"
ON public.ceo_ai_recommendations
FOR INSERT
WITH CHECK (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO can update recommendations"
ON public.ceo_ai_recommendations
FOR UPDATE
USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO can delete recommendations"
ON public.ceo_ai_recommendations
FOR DELETE
USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

-- Create table for CEO AI chat history
CREATE TABLE public.ceo_ai_chat (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ceo_ai_chat ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Only CEO can access
CREATE POLICY "CEO can view chat"
ON public.ceo_ai_chat
FOR SELECT
USING (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

CREATE POLICY "CEO can insert chat"
ON public.ceo_ai_chat
FOR INSERT
WITH CHECK (auth.jwt() ->> 'email' = 'fabricio@universidadevendas.com.br');

-- Trigger for updated_at
CREATE TRIGGER update_ceo_ai_recommendations_updated_at
BEFORE UPDATE ON public.ceo_ai_recommendations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();