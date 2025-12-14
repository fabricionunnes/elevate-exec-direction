-- Tabela para armazenar respostas do questionário de clientes
CREATE TABLE public.client_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Dados do cliente
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  
  -- Respostas do diagnóstico
  revenue TEXT NOT NULL,
  team_size TEXT NOT NULL,
  main_pain TEXT NOT NULL,
  has_sales_process BOOLEAN NOT NULL DEFAULT false,
  biggest_challenge TEXT,
  urgency TEXT NOT NULL DEFAULT 'normal',
  
  -- Produto recomendado
  recommended_product TEXT,
  
  -- Status de acompanhamento
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT
);

-- Habilitar RLS
ALTER TABLE public.client_diagnostics ENABLE ROW LEVEL SECURITY;

-- Política para inserção pública (clientes podem enviar diagnóstico sem login)
CREATE POLICY "Anyone can submit diagnostic" 
ON public.client_diagnostics 
FOR INSERT 
WITH CHECK (true);

-- Para leitura, apenas através de admin (por enquanto desabilitado para clientes)
-- Admin será implementado posteriormente se necessário