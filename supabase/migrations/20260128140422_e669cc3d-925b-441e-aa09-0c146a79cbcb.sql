-- Adicionar team_id à tabela de setores para a cascata
ALTER TABLE public.company_sectors ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.company_teams(id);

-- Adicionar sector_id à tabela de vendedores
ALTER TABLE public.company_salespeople ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES public.company_sectors(id);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_sectors_team ON public.company_sectors(team_id);
CREATE INDEX IF NOT EXISTS idx_salespeople_sector ON public.company_salespeople(sector_id);