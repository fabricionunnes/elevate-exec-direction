-- UNV Office vira prédio: cada sala pertence a um andar (0 = térreo). Fase 1 (Fabrício, 13/10/2026).
ALTER TABLE public.office_team_rooms ADD COLUMN IF NOT EXISTS floor integer NOT NULL DEFAULT 0;
-- distribuição inicial: térreo = reuniões, lounge e salas pessoais; setores sobem pros andares
UPDATE public.office_team_rooms SET floor = 0 WHERE room_type in ('meeting','lounge','personal');
UPDATE public.office_team_rooms SET floor = 1 WHERE room_type = 'sector' AND sector = 'comercial';
UPDATE public.office_team_rooms SET floor = 2 WHERE room_type = 'sector' AND sector = 'produto';
UPDATE public.office_team_rooms SET floor = 3 WHERE room_type = 'sector' AND sector = 'marketing';
UPDATE public.office_team_rooms SET floor = 4 WHERE room_type = 'sector' AND sector = 'financeiro';
UPDATE public.office_team_rooms SET floor = 5 WHERE room_type = 'sector' AND sector = 'lideranca';
UPDATE public.office_team_rooms SET floor = 5 WHERE room_type = 'personal' AND name = 'Sala Fabrício';
