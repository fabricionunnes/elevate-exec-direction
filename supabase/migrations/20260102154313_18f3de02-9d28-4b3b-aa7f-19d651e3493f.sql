-- Insert master template tasks that apply to ALL products
INSERT INTO public.onboarding_task_templates (product_id, title, description, default_days_offset, sort_order, responsible_role, priority, phase, phase_order)
VALUES
-- 🔴 FASE 0 — PRÉ-VENDA & CURADORIA (D-7 a D-1)
('master', 'Lead aprovado na curadoria', 'Validar aprovação do lead na curadoria antes de prosseguir', -7, 1, 'consultant', 'high', 'Pré-Venda & Curadoria', 0),
('master', 'Validar ICP do produto', 'Confirmar que o lead se encaixa no perfil de cliente ideal do produto', -7, 2, 'consultant', 'high', 'Pré-Venda & Curadoria', 0),
('master', 'Validar pré-requisitos do serviço', 'Verificar se o cliente atende os pré-requisitos mínimos para o serviço', -6, 3, 'consultant', 'high', 'Pré-Venda & Curadoria', 0),
('master', 'Registrar resumo da venda no CRM', 'Documentar informações principais da negociação no CRM', -6, 4, 'consultant', 'medium', 'Pré-Venda & Curadoria', 0),
('master', 'Definir produto contratado', 'Especificar qual produto/serviço foi contratado pelo cliente', -5, 5, 'consultant', 'high', 'Pré-Venda & Curadoria', 0),
('master', 'Definir escopo correto', 'Detalhar escopo do serviço para evitar expectativas desalinhadas', -5, 6, 'consultant', 'high', 'Pré-Venda & Curadoria', 0),
('master', 'Enviar proposta comercial', 'Enviar proposta comercial formal ao cliente', -4, 7, 'consultant', 'high', 'Pré-Venda & Curadoria', 0),
('master', 'Negociação e alinhamento final', 'Finalizar negociação e alinhar últimos detalhes', -3, 8, 'consultant', 'high', 'Pré-Venda & Curadoria', 0),
('master', 'Aprovação final do cliente', 'Obter aprovação formal do cliente para prosseguir', -2, 9, 'consultant', 'high', 'Pré-Venda & Curadoria', 0),

-- 🔵 FASE 1 — CONTRATO & FINANCEIRO (D-1 a D0)
('master', 'Enviar contrato oficial UNV', 'Enviar contrato oficial para assinatura do cliente', -1, 10, 'cs', 'high', 'Contrato & Financeiro', 1),
('master', 'Validar contrato assinado', 'Confirmar que contrato foi assinado pelo cliente', 0, 11, 'cs', 'high', 'Contrato & Financeiro', 1),
('master', 'Validar pagamento aprovado', 'Confirmar aprovação do pagamento (cartão/boleto)', 0, 12, 'cs', 'high', 'Contrato & Financeiro', 1),
('master', 'Registrar contrato no Drive UNV', 'Salvar contrato assinado na pasta do cliente', 0, 13, 'cs', 'medium', 'Contrato & Financeiro', 1),
('master', 'Criar pasta jurídica do cliente', 'Criar estrutura de pastas para documentos jurídicos', 0, 14, 'cs', 'medium', 'Contrato & Financeiro', 1),
('master', 'Atualizar status para Cliente Ativo', 'Mudar status do cliente para ativo nos sistemas', 0, 15, 'cs', 'medium', 'Contrato & Financeiro', 1),

-- 🟦 FASE 2 — ONBOARDING ADMINISTRATIVO (D+0 a D+3)
('master', 'Criar projeto no sistema', 'Criar projeto de onboarding no sistema de gestão', 0, 16, 'cs', 'high', 'Onboarding Administrativo', 2),
('master', 'Criar cadastro do cliente nos sistemas UNV', 'Registrar cliente em todos os sistemas internos necessários', 0, 17, 'cs', 'high', 'Onboarding Administrativo', 2),
('master', 'Enviar e-mail de boas-vindas oficial', 'Enviar comunicação oficial de boas-vindas ao cliente', 0, 18, 'cs', 'high', 'Onboarding Administrativo', 2),
('master', 'Enviar guia do produto contratado', 'Enviar material explicativo sobre o produto/serviço', 0, 19, 'cs', 'medium', 'Onboarding Administrativo', 2),
('master', 'Enviar checklist de acessos e documentos', 'Enviar lista de acessos e documentos necessários', 0, 20, 'cs', 'high', 'Onboarding Administrativo', 2),
('master', 'Definir responsáveis internos do cliente', 'Identificar pontos de contato e responsáveis no cliente', 1, 21, 'cs', 'high', 'Onboarding Administrativo', 2),
('master', 'Definir canais oficiais de comunicação', 'Estabelecer canais oficiais de comunicação do projeto', 1, 22, 'cs', 'medium', 'Onboarding Administrativo', 2),
('master', 'Agendar reunião de briefing', 'Agendar primeira reunião de briefing estratégico', 2, 23, 'cs', 'high', 'Onboarding Administrativo', 2),
('master', 'Atualizar status para Briefing', 'Atualizar status do projeto para fase de briefing', 3, 24, 'cs', 'low', 'Onboarding Administrativo', 2),

-- 🟨 FASE 3 — BRIEFING ESTRATÉGICO (D+3 a D+7)
('master', 'Reunião de briefing estratégico', 'Conduzir reunião de briefing estratégico com o cliente', 3, 25, 'consultant', 'high', 'Briefing Estratégico', 3),
('master', 'Levantar objetivos principais', 'Identificar e documentar objetivos principais do cliente', 3, 26, 'consultant', 'high', 'Briefing Estratégico', 3),
('master', 'Levantar metas atuais', 'Mapear metas atuais do cliente', 4, 27, 'consultant', 'high', 'Briefing Estratégico', 3),
('master', 'Levantar estrutura de time', 'Documentar estrutura atual do time do cliente', 4, 28, 'consultant', 'medium', 'Briefing Estratégico', 3),
('master', 'Levantar processos atuais', 'Mapear processos atuais relevantes ao projeto', 5, 29, 'consultant', 'medium', 'Briefing Estratégico', 3),
('master', 'Levantar indicadores existentes', 'Identificar indicadores e métricas já utilizados', 5, 30, 'consultant', 'medium', 'Briefing Estratégico', 3),
('master', 'Registrar briefing completo no projeto', 'Documentar todas as informações do briefing no sistema', 6, 31, 'consultant', 'high', 'Briefing Estratégico', 3),
('master', 'Validar briefing com cliente', 'Confirmar informações do briefing com o cliente', 7, 32, 'consultant', 'high', 'Briefing Estratégico', 3),

-- 🟧 FASE 4 — DIAGNÓSTICO (D+7 a D+15)
('master', 'Analisar cenário atual', 'Realizar análise detalhada do cenário atual do cliente', 8, 33, 'consultant', 'high', 'Diagnóstico', 4),
('master', 'Identificar gargalos críticos', 'Mapear principais gargalos e pontos de melhoria', 10, 34, 'consultant', 'high', 'Diagnóstico', 4),
('master', 'Avaliar riscos do projeto', 'Identificar e documentar riscos potenciais do projeto', 11, 35, 'consultant', 'medium', 'Diagnóstico', 4),
('master', 'Avaliar maturidade da empresa', 'Avaliar nível de maturidade da empresa nas áreas relevantes', 12, 36, 'consultant', 'medium', 'Diagnóstico', 4),
('master', 'Criar diagnóstico consolidado', 'Consolidar todas as análises em diagnóstico final', 14, 37, 'consultant', 'high', 'Diagnóstico', 4),
('master', 'Reunião de apresentação do diagnóstico', 'Apresentar diagnóstico consolidado ao cliente', 15, 38, 'consultant', 'high', 'Diagnóstico', 4),

-- 🟩 FASE 5 — PLANEJAMENTO & DESENHO (D+15 a D+25)
('master', 'Definir objetivos claros do projeto', 'Estabelecer objetivos SMART para o projeto', 16, 39, 'consultant', 'high', 'Planejamento & Desenho', 5),
('master', 'Criar plano de execução detalhado', 'Desenvolver plano de execução com todas as etapas', 18, 40, 'consultant', 'high', 'Planejamento & Desenho', 5),
('master', 'Definir KPIs do projeto', 'Estabelecer indicadores de sucesso do projeto', 19, 41, 'consultant', 'high', 'Planejamento & Desenho', 5),
('master', 'Definir responsáveis por frente', 'Designar responsáveis para cada frente de trabalho', 20, 42, 'consultant', 'medium', 'Planejamento & Desenho', 5),
('master', 'Definir cronograma detalhado', 'Criar cronograma com marcos e entregas', 22, 43, 'consultant', 'high', 'Planejamento & Desenho', 5),
('master', 'Validar plano com cliente', 'Aprovar plano de execução com o cliente', 25, 44, 'consultant', 'high', 'Planejamento & Desenho', 5),

-- 🟪 FASE 6 — IMPLEMENTAÇÃO (D+25 até D+X)
('master', 'Executar entregável 1', 'Executar primeiro entregável conforme plano', 26, 45, 'consultant', 'high', 'Implementação', 6),
('master', 'Executar entregável 2', 'Executar segundo entregável conforme plano', 30, 46, 'consultant', 'high', 'Implementação', 6),
('master', 'Executar entregável 3', 'Executar terceiro entregável conforme plano', 35, 47, 'consultant', 'high', 'Implementação', 6),
('master', 'Acompanhar execução do cliente', 'Monitorar execução das ações pelo cliente (semanal)', 32, 48, 'consultant', 'medium', 'Implementação', 6),
('master', 'Ajustar execução conforme dados', 'Realizar ajustes necessários baseado em resultados', 40, 49, 'consultant', 'medium', 'Implementação', 6),

-- 🟫 FASE 7 — ACOMPANHAMENTO & GOVERNANÇA (RECORRENTE)
('master', 'Reunião de acompanhamento semanal', 'Conduzir reunião semanal de acompanhamento', 35, 50, 'consultant', 'high', 'Acompanhamento & Governança', 7),
('master', 'Monitorar indicadores', 'Acompanhar evolução dos indicadores definidos', 35, 51, 'consultant', 'high', 'Acompanhamento & Governança', 7),
('master', 'Corrigir desvios identificados', 'Implementar correções para desvios encontrados', 40, 52, 'consultant', 'high', 'Acompanhamento & Governança', 7),
('master', 'Registrar evolução no sistema', 'Documentar progresso e evolução no sistema', 35, 53, 'consultant', 'medium', 'Acompanhamento & Governança', 7),
('master', 'Alinhar expectativas quinzenal', 'Realizar alinhamento de expectativas com liderança', 45, 54, 'consultant', 'medium', 'Acompanhamento & Governança', 7),

-- 🟤 FASE 8 — ESTABILIZAÇÃO & OTIMIZAÇÃO
('master', 'Avaliar adoção do processo', 'Verificar nível de adoção dos processos implementados', 60, 55, 'consultant', 'high', 'Estabilização & Otimização', 8),
('master', 'Ajustar modelo final', 'Realizar ajustes finais no modelo implementado', 65, 56, 'consultant', 'medium', 'Estabilização & Otimização', 8),
('master', 'Preparar autonomia do cliente', 'Capacitar cliente para manter operação de forma autônoma', 70, 57, 'consultant', 'high', 'Estabilização & Otimização', 8),

-- ⚫ FASE 9 — ENCERRAMENTO & ASCENSÃO
('master', 'Consolidar resultados', 'Compilar todos os resultados alcançados no projeto', 85, 58, 'consultant', 'high', 'Encerramento & Ascensão', 9),
('master', 'Reunião final de encerramento', 'Conduzir reunião formal de encerramento do projeto', 88, 59, 'consultant', 'high', 'Encerramento & Ascensão', 9),
('master', 'Avaliar NPS', 'Aplicar pesquisa de satisfação NPS', 89, 60, 'cs', 'high', 'Encerramento & Ascensão', 9),
('master', 'Avaliar oportunidades de upsell/cross-sell', 'Identificar oportunidades de novos serviços', 89, 61, 'consultant', 'medium', 'Encerramento & Ascensão', 9),
('master', 'Encerrar projeto no sistema', 'Finalizar e arquivar projeto no sistema', 90, 62, 'cs', 'medium', 'Encerramento & Ascensão', 9);