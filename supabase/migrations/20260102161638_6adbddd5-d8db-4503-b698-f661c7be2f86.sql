
-- Delete all existing templates to start fresh
DELETE FROM onboarding_task_templates;

-- =============================================
-- FASE 0 — PRÉ-VENDA, CURADORIA E QUALIFICAÇÃO
-- =============================================
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('default', 'Receber lead do comercial', 'Pré-venda e Curadoria', 0, 1, 'high', 'cs'),
('default', 'Avaliar fit com o produto vendido', 'Pré-venda e Curadoria', 0, 2, 'high', 'consultant'),
('default', 'Validar faturamento mínimo', 'Pré-venda e Curadoria', 0, 3, 'high', 'consultant'),
('default', 'Validar estrutura mínima do cliente', 'Pré-venda e Curadoria', 0, 4, 'high', 'consultant'),
('default', 'Validar maturidade do time', 'Pré-venda e Curadoria', 0, 5, 'high', 'consultant'),
('default', 'Registrar objeções levantadas na venda', 'Pré-venda e Curadoria', 0, 6, 'medium', 'cs'),
('default', 'Registrar expectativas do cliente', 'Pré-venda e Curadoria', 0, 7, 'high', 'cs'),
('default', 'Avaliar risco de churn', 'Pré-venda e Curadoria', 0, 8, 'high', 'consultant'),
('default', 'Aprovar cliente na curadoria', 'Pré-venda e Curadoria', 0, 9, 'high', 'consultant'),
('default', 'Definir produto correto (evitar venda errada)', 'Pré-venda e Curadoria', 0, 10, 'high', 'consultant'),
('default', 'Definir escopo contratado', 'Pré-venda e Curadoria', 0, 11, 'high', 'consultant'),
('default', 'Validar se há dependência de outros produtos', 'Pré-venda e Curadoria', 0, 12, 'medium', 'consultant'),
('default', 'Registrar decisão final de aceite', 'Pré-venda e Curadoria', 0, 13, 'high', 'consultant');

-- =============================================
-- FASE 1 — CONTRATO, FINANCEIRO E COMPLIANCE
-- =============================================
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('default', 'Enviar contrato padrão UNV', 'Contrato e Compliance', 1, 1, 'high', 'cs'),
('default', 'Acompanhar assinatura do contrato', 'Contrato e Compliance', 1, 2, 'high', 'cs'),
('default', 'Validar contrato assinado corretamente', 'Contrato e Compliance', 1, 3, 'high', 'cs'),
('default', 'Validar forma de pagamento (cartão)', 'Contrato e Compliance', 1, 4, 'high', 'cs'),
('default', 'Confirmar aprovação do pagamento', 'Contrato e Compliance', 1, 5, 'high', 'cs'),
('default', 'Registrar contrato no Drive', 'Contrato e Compliance', 1, 6, 'medium', 'cs'),
('default', 'Criar pasta jurídica do cliente', 'Contrato e Compliance', 1, 7, 'medium', 'cs'),
('default', 'Criar registro financeiro interno', 'Contrato e Compliance', 1, 8, 'medium', 'cs'),
('default', 'Liberar início do projeto', 'Contrato e Compliance', 1, 9, 'high', 'cs'),
('default', 'Atualizar status para Cliente Ativo', 'Contrato e Compliance', 1, 10, 'high', 'cs');

-- =============================================
-- FASE 2 — ONBOARDING ADMINISTRATIVO COMPLETO
-- =============================================
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('default', 'Criar projeto no sistema', 'Onboarding Administrativo', 2, 1, 'high', 'cs'),
('default', 'Criar estrutura de pastas do projeto', 'Onboarding Administrativo', 2, 2, 'medium', 'cs'),
('default', 'Criar cadastro do cliente nos sistemas UNV', 'Onboarding Administrativo', 2, 3, 'high', 'cs'),
('default', 'Enviar e-mail oficial de boas-vindas', 'Onboarding Administrativo', 2, 4, 'high', 'cs'),
('default', 'Enviar apresentação institucional UNV', 'Onboarding Administrativo', 2, 5, 'medium', 'cs'),
('default', 'Enviar explicação detalhada do produto contratado', 'Onboarding Administrativo', 2, 6, 'high', 'cs'),
('default', 'Enviar checklist completo de acessos', 'Onboarding Administrativo', 2, 7, 'high', 'cs'),
('default', 'Enviar checklist de documentos', 'Onboarding Administrativo', 2, 8, 'medium', 'cs'),
('default', 'Aguardar checklist preenchido', 'Onboarding Administrativo', 2, 9, 'medium', 'cs'),
('default', 'Validar acessos recebidos', 'Onboarding Administrativo', 2, 10, 'high', 'cs'),
('default', 'Cobrar acessos pendentes', 'Onboarding Administrativo', 2, 11, 'high', 'cs'),
('default', 'Definir responsáveis internos do cliente', 'Onboarding Administrativo', 2, 12, 'high', 'consultant'),
('default', 'Definir sponsor executivo do cliente', 'Onboarding Administrativo', 2, 13, 'high', 'consultant'),
('default', 'Definir líder operacional do cliente', 'Onboarding Administrativo', 2, 14, 'high', 'consultant'),
('default', 'Definir canal oficial de comunicação', 'Onboarding Administrativo', 2, 15, 'medium', 'cs'),
('default', 'Definir regras de comunicação', 'Onboarding Administrativo', 2, 16, 'medium', 'cs'),
('default', 'Agendar reunião de briefing', 'Onboarding Administrativo', 2, 17, 'high', 'cs');

-- =============================================
-- FASE 3 — BRIEFING PROFUNDO
-- =============================================
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('default', 'Realizar reunião de briefing', 'Briefing Profundo', 3, 1, 'high', 'consultant'),
('default', 'Levantar objetivos estratégicos', 'Briefing Profundo', 3, 2, 'high', 'consultant'),
('default', 'Levantar metas atuais', 'Briefing Profundo', 3, 3, 'high', 'consultant'),
('default', 'Levantar histórico da empresa', 'Briefing Profundo', 3, 4, 'medium', 'consultant'),
('default', 'Levantar modelo de negócio', 'Briefing Profundo', 3, 5, 'high', 'consultant'),
('default', 'Levantar ICP atual', 'Briefing Profundo', 3, 6, 'high', 'consultant'),
('default', 'Levantar estrutura do time comercial', 'Briefing Profundo', 3, 7, 'high', 'consultant'),
('default', 'Levantar cargos e funções', 'Briefing Profundo', 3, 8, 'medium', 'consultant'),
('default', 'Levantar processos existentes', 'Briefing Profundo', 3, 9, 'high', 'consultant'),
('default', 'Levantar indicadores atuais', 'Briefing Profundo', 3, 10, 'high', 'consultant'),
('default', 'Levantar ferramentas utilizadas', 'Briefing Profundo', 3, 11, 'medium', 'consultant'),
('default', 'Levantar canais de aquisição', 'Briefing Profundo', 3, 12, 'high', 'consultant'),
('default', 'Levantar gargalos percebidos pelo dono', 'Briefing Profundo', 3, 13, 'high', 'consultant'),
('default', 'Levantar gargalos percebidos pelo time', 'Briefing Profundo', 3, 14, 'high', 'consultant'),
('default', 'Levantar expectativas de curto prazo', 'Briefing Profundo', 3, 15, 'high', 'consultant'),
('default', 'Levantar expectativas de longo prazo', 'Briefing Profundo', 3, 16, 'medium', 'consultant'),
('default', 'Registrar briefing completo', 'Briefing Profundo', 3, 17, 'high', 'consultant'),
('default', 'Validar briefing com o cliente', 'Briefing Profundo', 3, 18, 'high', 'consultant');

-- =============================================
-- FASE 4 — DIAGNÓSTICO PROFUNDO
-- =============================================
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('default', 'Analisar estrutura comercial', 'Diagnóstico Profundo', 4, 1, 'high', 'consultant'),
('default', 'Analisar processo de vendas', 'Diagnóstico Profundo', 4, 2, 'high', 'consultant'),
('default', 'Analisar funil e conversões', 'Diagnóstico Profundo', 4, 3, 'high', 'consultant'),
('default', 'Analisar metas e indicadores', 'Diagnóstico Profundo', 4, 4, 'high', 'consultant'),
('default', 'Analisar discurso comercial', 'Diagnóstico Profundo', 4, 5, 'high', 'consultant'),
('default', 'Analisar capacidade do time', 'Diagnóstico Profundo', 4, 6, 'high', 'consultant'),
('default', 'Analisar dependência do dono', 'Diagnóstico Profundo', 4, 7, 'high', 'consultant'),
('default', 'Analisar riscos operacionais', 'Diagnóstico Profundo', 4, 8, 'medium', 'consultant'),
('default', 'Analisar riscos de churn', 'Diagnóstico Profundo', 4, 9, 'high', 'consultant'),
('default', 'Analisar maturidade da empresa', 'Diagnóstico Profundo', 4, 10, 'medium', 'consultant'),
('default', 'Identificar gargalos críticos', 'Diagnóstico Profundo', 4, 11, 'high', 'consultant'),
('default', 'Priorizar gargalos', 'Diagnóstico Profundo', 4, 12, 'high', 'consultant'),
('default', 'Criar diagnóstico consolidado', 'Diagnóstico Profundo', 4, 13, 'high', 'consultant'),
('default', 'Preparar apresentação do diagnóstico', 'Diagnóstico Profundo', 4, 14, 'high', 'consultant'),
('default', 'Reunião de validação do diagnóstico', 'Diagnóstico Profundo', 4, 15, 'high', 'consultant');

-- =============================================
-- FASE 5 — PLANEJAMENTO EXECUTIVO
-- =============================================
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('default', 'Definir objetivo central do projeto', 'Planejamento Executivo', 5, 1, 'high', 'consultant'),
('default', 'Definir metas claras do projeto', 'Planejamento Executivo', 5, 2, 'high', 'consultant'),
('default', 'Definir KPIs de acompanhamento', 'Planejamento Executivo', 5, 3, 'high', 'consultant'),
('default', 'Definir responsáveis por frente', 'Planejamento Executivo', 5, 4, 'high', 'consultant'),
('default', 'Criar plano de ação detalhado', 'Planejamento Executivo', 5, 5, 'high', 'consultant'),
('default', 'Criar cronograma por semana', 'Planejamento Executivo', 5, 6, 'high', 'consultant'),
('default', 'Definir checkpoints de validação', 'Planejamento Executivo', 5, 7, 'medium', 'consultant'),
('default', 'Definir critérios de sucesso', 'Planejamento Executivo', 5, 8, 'high', 'consultant'),
('default', 'Definir critérios de falha', 'Planejamento Executivo', 5, 9, 'medium', 'consultant'),
('default', 'Validar plano com o cliente', 'Planejamento Executivo', 5, 10, 'high', 'consultant');

-- =============================================
-- FASE 7 — ACOMPANHAMENTO CONTÍNUO (com recurrence)
-- =============================================
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role, recurrence) VALUES
('default', 'Reunião semanal de acompanhamento', 'Acompanhamento Contínuo', 7, 1, 'high', 'cs', 'weekly'),
('default', 'Analisar indicadores semanalmente', 'Acompanhamento Contínuo', 7, 2, 'high', 'consultant', 'weekly'),
('default', 'Analisar adesão do time', 'Acompanhamento Contínuo', 7, 3, 'high', 'consultant', 'weekly'),
('default', 'Corrigir desvios operacionais', 'Acompanhamento Contínuo', 7, 4, 'high', 'consultant', NULL),
('default', 'Ajustar processo conforme dados', 'Acompanhamento Contínuo', 7, 5, 'medium', 'consultant', NULL),
('default', 'Registrar evolução no sistema', 'Acompanhamento Contínuo', 7, 6, 'medium', 'cs', 'weekly'),
('default', 'Alinhar expectativas com o cliente', 'Acompanhamento Contínuo', 7, 7, 'high', 'consultant', 'weekly'),
('default', 'Cobrar execução do que foi definido', 'Acompanhamento Contínuo', 7, 8, 'high', 'cs', 'weekly');

-- =============================================
-- FASE 8 — ESTABILIZAÇÃO E AUTONOMIA
-- =============================================
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('default', 'Avaliar maturidade do cliente', 'Estabilização e Autonomia', 8, 1, 'high', 'consultant'),
('default', 'Ajustar processo final', 'Estabilização e Autonomia', 8, 2, 'high', 'consultant'),
('default', 'Validar autonomia da liderança', 'Estabilização e Autonomia', 8, 3, 'high', 'consultant'),
('default', 'Criar plano de continuidade', 'Estabilização e Autonomia', 8, 4, 'high', 'consultant'),
('default', 'Transferir responsabilidade ao cliente', 'Estabilização e Autonomia', 8, 5, 'high', 'consultant');

-- =============================================
-- FASE 9 — ENCERRAMENTO PROFISSIONAL
-- =============================================
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('default', 'Consolidar entregáveis finais', 'Encerramento Profissional', 9, 1, 'high', 'consultant'),
('default', 'Preparar relatório final', 'Encerramento Profissional', 9, 2, 'high', 'consultant'),
('default', 'Reunião de encerramento', 'Encerramento Profissional', 9, 3, 'high', 'consultant'),
('default', 'Avaliar NPS', 'Encerramento Profissional', 9, 4, 'high', 'cs'),
('default', 'Identificar oportunidades de upsell', 'Encerramento Profissional', 9, 5, 'high', 'cs'),
('default', 'Registrar aprendizados do projeto', 'Encerramento Profissional', 9, 6, 'medium', 'consultant'),
('default', 'Encerrar projeto no sistema', 'Encerramento Profissional', 9, 7, 'high', 'cs');
