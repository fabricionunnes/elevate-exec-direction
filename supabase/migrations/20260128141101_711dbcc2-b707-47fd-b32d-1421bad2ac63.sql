-- Criar tabela de junção para Equipes <-> Unidades (muitos-para-muitos)
CREATE TABLE public.company_team_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.company_teams(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.company_units(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, unit_id)
);

-- Criar tabela de junção para Setores <-> Equipes (muitos-para-muitos)
CREATE TABLE public.company_sector_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sector_id UUID NOT NULL REFERENCES public.company_sectors(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.company_teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sector_id, team_id)
);

-- Índices para performance
CREATE INDEX idx_team_units_team ON public.company_team_units(team_id);
CREATE INDEX idx_team_units_unit ON public.company_team_units(unit_id);
CREATE INDEX idx_sector_teams_sector ON public.company_sector_teams(sector_id);
CREATE INDEX idx_sector_teams_team ON public.company_sector_teams(team_id);

-- Migrar dados existentes de company_teams.unit_id para a nova tabela
INSERT INTO public.company_team_units (team_id, unit_id)
SELECT id, unit_id FROM public.company_teams WHERE unit_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migrar dados existentes de company_sectors.team_id para a nova tabela
INSERT INTO public.company_sector_teams (sector_id, team_id)
SELECT id, team_id FROM public.company_sectors WHERE team_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Habilitar RLS
ALTER TABLE public.company_team_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_sector_teams ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para company_team_units
CREATE POLICY "Staff can view team units" ON public.company_team_units
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Staff can manage team units" ON public.company_team_units
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
);

-- Políticas RLS para company_sector_teams
CREATE POLICY "Staff can view sector teams" ON public.company_sector_teams
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Staff can manage sector teams" ON public.company_sector_teams
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
);