-- Atualizar TODAS as fases master com offsets corretos
-- FASE 5 - Diagnóstico Profundo (D21 a D30)
UPDATE onboarding_task_templates 
SET default_days_offset = 21 + (sort_order - 1)
WHERE product_id = 'master' AND phase = 'Diagnóstico Profundo';

-- FASE 6 - Planejamento Executivo (D31 a D40)
UPDATE onboarding_task_templates 
SET default_days_offset = 31 + (sort_order - 1)
WHERE product_id = 'master' AND phase = 'Planejamento Executivo';

-- FASE 7 - Acompanhamento Contínuo (D41 a D55, recorrente)
UPDATE onboarding_task_templates 
SET default_days_offset = 41 + (sort_order - 1) * 2
WHERE product_id = 'master' AND phase = 'Acompanhamento Contínuo';

-- FASE 8 - Estabilização e Autonomia (D56 a D70)
UPDATE onboarding_task_templates 
SET default_days_offset = 56 + (sort_order - 1) * 3
WHERE product_id = 'master' AND phase = 'Estabilização e Autonomia';

-- FASE 9 - Encerramento Profissional (D71 a D90)
UPDATE onboarding_task_templates 
SET default_days_offset = 71 + (sort_order - 1) * 3
WHERE product_id = 'master' AND phase = 'Encerramento Profissional';

-- Atualizar offsets das tarefas de produto específico para começar após D90
UPDATE onboarding_task_templates 
SET default_days_offset = 91 + (sort_order - 1) * 3
WHERE product_id NOT IN ('master');