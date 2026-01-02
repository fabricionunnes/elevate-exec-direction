-- Atualizar offsets das tarefas master por FASE
-- FASE 1 - Pré-venda e Curadoria (D-7 a D-1)
UPDATE onboarding_task_templates 
SET default_days_offset = -7 + (sort_order - 1) * 0.5
WHERE product_id = 'master' AND phase = 'Pré-venda e Curadoria';

-- FASE 2 - Contrato e Compliance (D0 a D2)
UPDATE onboarding_task_templates 
SET default_days_offset = 0 
WHERE product_id = 'master' AND phase = 'Contrato e Compliance' AND sort_order <= 5;

UPDATE onboarding_task_templates 
SET default_days_offset = 1 
WHERE product_id = 'master' AND phase = 'Contrato e Compliance' AND sort_order BETWEEN 6 AND 8;

UPDATE onboarding_task_templates 
SET default_days_offset = 2 
WHERE product_id = 'master' AND phase = 'Contrato e Compliance' AND sort_order > 8;

-- FASE 3 - Onboarding Administrativo (D3 a D10)
UPDATE onboarding_task_templates 
SET default_days_offset = 3 
WHERE product_id = 'master' AND phase = 'Onboarding Administrativo' AND sort_order <= 5;

UPDATE onboarding_task_templates 
SET default_days_offset = 5 
WHERE product_id = 'master' AND phase = 'Onboarding Administrativo' AND sort_order BETWEEN 6 AND 10;

UPDATE onboarding_task_templates 
SET default_days_offset = 7 
WHERE product_id = 'master' AND phase = 'Onboarding Administrativo' AND sort_order BETWEEN 11 AND 15;

UPDATE onboarding_task_templates 
SET default_days_offset = 10 
WHERE product_id = 'master' AND phase = 'Onboarding Administrativo' AND sort_order > 15;

-- FASE 4 - Briefing Profundo (D11 a D20)
UPDATE onboarding_task_templates 
SET default_days_offset = 11 
WHERE product_id = 'master' AND phase = 'Briefing Profundo' AND sort_order <= 5;

UPDATE onboarding_task_templates 
SET default_days_offset = 13 
WHERE product_id = 'master' AND phase = 'Briefing Profundo' AND sort_order BETWEEN 6 AND 10;

UPDATE onboarding_task_templates 
SET default_days_offset = 15 
WHERE product_id = 'master' AND phase = 'Briefing Profundo' AND sort_order BETWEEN 11 AND 15;

UPDATE onboarding_task_templates 
SET default_days_offset = 17 
WHERE product_id = 'master' AND phase = 'Briefing Profundo' AND sort_order BETWEEN 16 AND 20;

UPDATE onboarding_task_templates 
SET default_days_offset = 20 
WHERE product_id = 'master' AND phase = 'Briefing Profundo' AND sort_order > 20;

-- FASE 5 - Plano de Ação Inicial (D21 a D30)
UPDATE onboarding_task_templates 
SET default_days_offset = 21 
WHERE product_id = 'master' AND phase = 'Plano de Ação Inicial' AND sort_order <= 5;

UPDATE onboarding_task_templates 
SET default_days_offset = 24 
WHERE product_id = 'master' AND phase = 'Plano de Ação Inicial' AND sort_order BETWEEN 6 AND 10;

UPDATE onboarding_task_templates 
SET default_days_offset = 27 
WHERE product_id = 'master' AND phase = 'Plano de Ação Inicial' AND sort_order BETWEEN 11 AND 15;

UPDATE onboarding_task_templates 
SET default_days_offset = 30 
WHERE product_id = 'master' AND phase = 'Plano de Ação Inicial' AND sort_order > 15;

-- FASE 6 - Acompanhamento Recorrente (D31+, tarefas recorrentes)
UPDATE onboarding_task_templates 
SET default_days_offset = 31 
WHERE product_id = 'master' AND phase = 'Acompanhamento Recorrente' AND sort_order <= 5;

UPDATE onboarding_task_templates 
SET default_days_offset = 35 
WHERE product_id = 'master' AND phase = 'Acompanhamento Recorrente' AND sort_order BETWEEN 6 AND 10;

UPDATE onboarding_task_templates 
SET default_days_offset = 40 
WHERE product_id = 'master' AND phase = 'Acompanhamento Recorrente' AND sort_order > 10;

-- Garantir que tarefas de produto específico começam após as master (D46+)
UPDATE onboarding_task_templates 
SET default_days_offset = 46 + (sort_order - 1) * 2
WHERE product_id NOT IN ('master') AND default_days_offset < 46;