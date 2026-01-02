-- Add phase column to task templates for better organization
ALTER TABLE public.onboarding_task_templates 
ADD COLUMN IF NOT EXISTS phase TEXT,
ADD COLUMN IF NOT EXISTS phase_order INTEGER DEFAULT 0;

-- Clear existing sales-ops templates to recreate
DELETE FROM public.onboarding_task_templates WHERE product_id = 'sales-ops';

-- FASE 0 — PRÉ-ONBOARDING (D-2 a D0)
INSERT INTO public.onboarding_task_templates (product_id, title, description, default_days_offset, sort_order, responsible_role, priority, phase, phase_order) VALUES
('sales-ops', 'Validar contrato assinado', 'Garantir que o contrato foi devidamente assinado pelo cliente', -2, 1, 'cs', 'high', 'Pré-Onboarding', 0),
('sales-ops', 'Validar pagamento confirmado', 'Confirmar recebimento do pagamento inicial', -2, 2, 'cs', 'high', 'Pré-Onboarding', 0),
('sales-ops', 'Criar pasta do cliente (Drive/Notion)', 'Estruturar pasta de documentos do cliente', -1, 3, 'cs', 'medium', 'Pré-Onboarding', 0),
('sales-ops', 'Criar projeto no Asana', 'Criar projeto de acompanhamento interno', -1, 4, 'cs', 'medium', 'Pré-Onboarding', 0),
('sales-ops', 'Criar registro do cliente no CRM UNV', 'Cadastrar cliente no sistema interno', -1, 5, 'cs', 'medium', 'Pré-Onboarding', 0),
('sales-ops', 'Enviar e-mail de boas-vindas oficial', 'Disparar comunicação inicial de boas-vindas', 0, 6, 'cs', 'high', 'Pré-Onboarding', 0),
('sales-ops', 'Enviar checklist de acessos e documentos', 'Solicitar informações e acessos necessários', 0, 7, 'cs', 'high', 'Pré-Onboarding', 0),

-- FASE 1 — ONBOARDING & SETUP (D+1 a D+5)
('sales-ops', 'Receber checklist preenchido', 'Validar recebimento das informações solicitadas', 1, 8, 'cs', 'high', 'Onboarding & Setup', 1),
('sales-ops', 'Validar acessos recebidos', 'Testar acessos fornecidos pelo cliente', 1, 9, 'consultant', 'high', 'Onboarding & Setup', 1),
('sales-ops', 'Identificar decisor principal do projeto', 'Mapear stakeholder principal do lado do cliente', 1, 10, 'consultant', 'high', 'Onboarding & Setup', 1),
('sales-ops', 'Identificar líder comercial do cliente', 'Mapear responsável comercial operacional', 1, 11, 'consultant', 'medium', 'Onboarding & Setup', 1),
('sales-ops', 'Agendar reunião de kickoff', 'Definir data e horário do kickoff', 1, 12, 'cs', 'high', 'Onboarding & Setup', 1),
('sales-ops', 'Reunião de kickoff (escopo, cronograma, papéis)', 'Alinhamento inicial completo com o cliente', 2, 13, 'consultant', 'high', 'Onboarding & Setup', 1),
('sales-ops', 'Alinhar expectativas e limites do Sales Ops', 'Definir claramente o que está e não está no escopo', 2, 14, 'consultant', 'high', 'Onboarding & Setup', 1),
('sales-ops', 'Definir ferramenta oficial de CRM', 'Decidir qual CRM será utilizado no projeto', 3, 15, 'consultant', 'medium', 'Onboarding & Setup', 1),
('sales-ops', 'Definir canais oficiais de comunicação', 'Estabelecer canais de contato do projeto', 3, 16, 'consultant', 'medium', 'Onboarding & Setup', 1),
('sales-ops', 'Criar cronograma macro do projeto', 'Desenvolver timeline geral das entregas', 4, 17, 'consultant', 'high', 'Onboarding & Setup', 1),
('sales-ops', 'Atualizar status do projeto para Diagnóstico', 'Marcar início oficial da fase de diagnóstico', 5, 18, 'cs', 'low', 'Onboarding & Setup', 1),

-- FASE 2 — DIAGNÓSTICO COMERCIAL (D+6 a D+14)
('sales-ops', 'Mapear estrutura do time comercial', 'Documentar organograma e estrutura do time', 6, 19, 'consultant', 'high', 'Diagnóstico Comercial', 2),
('sales-ops', 'Mapear funções (SDR, Closer, Gerente)', 'Identificar papéis e responsabilidades atuais', 6, 20, 'consultant', 'high', 'Diagnóstico Comercial', 2),
('sales-ops', 'Mapear jornada atual do lead', 'Documentar fluxo do lead desde captação até fechamento', 7, 21, 'consultant', 'high', 'Diagnóstico Comercial', 2),
('sales-ops', 'Mapear canais de aquisição', 'Identificar todas as fontes de leads atuais', 7, 22, 'consultant', 'medium', 'Diagnóstico Comercial', 2),
('sales-ops', 'Mapear funil atual (etapas reais)', 'Documentar etapas reais do processo de vendas', 8, 23, 'consultant', 'high', 'Diagnóstico Comercial', 2),
('sales-ops', 'Levantar taxas de conversão por etapa', 'Calcular métricas de conversão atuais', 9, 24, 'consultant', 'high', 'Diagnóstico Comercial', 2),
('sales-ops', 'Levantar ticket médio atual', 'Calcular valor médio das vendas', 9, 25, 'consultant', 'medium', 'Diagnóstico Comercial', 2),
('sales-ops', 'Levantar ciclo médio de vendas', 'Calcular tempo médio do ciclo de vendas', 10, 26, 'consultant', 'medium', 'Diagnóstico Comercial', 2),
('sales-ops', 'Levantar volume mensal de leads', 'Quantificar entrada de leads por mês', 10, 27, 'consultant', 'medium', 'Diagnóstico Comercial', 2),
('sales-ops', 'Levantar metas atuais (se existirem)', 'Documentar metas vigentes do time', 11, 28, 'consultant', 'medium', 'Diagnóstico Comercial', 2),
('sales-ops', 'Identificar gargalos operacionais', 'Mapear problemas de execução no processo', 12, 29, 'consultant', 'high', 'Diagnóstico Comercial', 2),
('sales-ops', 'Identificar gargalos de gestão', 'Mapear problemas de gestão e liderança', 12, 30, 'consultant', 'high', 'Diagnóstico Comercial', 2),
('sales-ops', 'Avaliar aderência do processo ao ICP', 'Verificar alinhamento entre processo e perfil ideal', 13, 31, 'consultant', 'medium', 'Diagnóstico Comercial', 2),
('sales-ops', 'Consolidar diagnóstico Sales Ops', 'Compilar documento final de diagnóstico', 14, 32, 'consultant', 'high', 'Diagnóstico Comercial', 2),

-- FASE 3 — DESENHO DO PROCESSO IDEAL (D+15 a D+22)
('sales-ops', 'Definir ICP operacional', 'Criar definição clara do cliente ideal', 15, 33, 'consultant', 'high', 'Desenho do Processo', 3),
('sales-ops', 'Definir modelo de funil ideal', 'Projetar estrutura do funil otimizado', 16, 34, 'consultant', 'high', 'Desenho do Processo', 3),
('sales-ops', 'Definir etapas do funil', 'Detalhar cada etapa do novo funil', 16, 35, 'consultant', 'high', 'Desenho do Processo', 3),
('sales-ops', 'Definir critérios de passagem por etapa', 'Estabelecer gatilhos de movimentação', 17, 36, 'consultant', 'high', 'Desenho do Processo', 3),
('sales-ops', 'Definir responsabilidades por etapa', 'Atribuir donos para cada fase', 17, 37, 'consultant', 'medium', 'Desenho do Processo', 3),
('sales-ops', 'Definir SLAs de atendimento', 'Estabelecer tempos máximos de resposta', 18, 38, 'consultant', 'high', 'Desenho do Processo', 3),
('sales-ops', 'Definir indicadores por etapa', 'Criar KPIs para cada fase do funil', 18, 39, 'consultant', 'high', 'Desenho do Processo', 3),
('sales-ops', 'Definir modelo de forecast', 'Criar metodologia de previsão de vendas', 19, 40, 'consultant', 'high', 'Desenho do Processo', 3),
('sales-ops', 'Definir metas por função', 'Estabelecer metas individuais por cargo', 20, 41, 'consultant', 'high', 'Desenho do Processo', 3),
('sales-ops', 'Definir rotina semanal de gestão', 'Criar cadência de reuniões e rituais', 21, 42, 'consultant', 'medium', 'Desenho do Processo', 3),
('sales-ops', 'Validar processo ideal com cliente', 'Aprovar desenho do novo processo', 22, 43, 'consultant', 'high', 'Desenho do Processo', 3),

-- FASE 4 — IMPLEMENTAÇÃO DO CRM (D+23 a D+38)
('sales-ops', 'Criar estrutura do CRM', 'Configurar base do CRM para o cliente', 23, 44, 'consultant', 'high', 'Implementação CRM', 4),
('sales-ops', 'Criar pipelines no CRM', 'Implementar funis no sistema', 24, 45, 'consultant', 'high', 'Implementação CRM', 4),
('sales-ops', 'Criar campos obrigatórios', 'Configurar campos necessários para o processo', 25, 46, 'consultant', 'high', 'Implementação CRM', 4),
('sales-ops', 'Criar regras de obrigatoriedade', 'Implementar validações no sistema', 26, 47, 'consultant', 'medium', 'Implementação CRM', 4),
('sales-ops', 'Criar automações básicas', 'Configurar automações de notificação e atribuição', 27, 48, 'consultant', 'medium', 'Implementação CRM', 4),
('sales-ops', 'Criar dashboards operacionais', 'Desenvolver painéis para o time', 28, 49, 'consultant', 'high', 'Implementação CRM', 4),
('sales-ops', 'Criar relatórios gerenciais', 'Desenvolver relatórios para gestão', 29, 50, 'consultant', 'high', 'Implementação CRM', 4),
('sales-ops', 'Criar perfis e permissões', 'Configurar acessos por função', 30, 51, 'consultant', 'medium', 'Implementação CRM', 4),
('sales-ops', 'Importar leads e oportunidades', 'Migrar dados existentes para o CRM', 31, 52, 'consultant', 'high', 'Implementação CRM', 4),
('sales-ops', 'Testar fluxo completo do funil', 'Validar funcionamento end-to-end', 33, 53, 'consultant', 'high', 'Implementação CRM', 4),
('sales-ops', 'Corrigir falhas técnicas', 'Ajustar bugs e problemas identificados', 35, 54, 'consultant', 'high', 'Implementação CRM', 4),
('sales-ops', 'Validar CRM com liderança', 'Aprovar configuração final com gestores', 37, 55, 'consultant', 'high', 'Implementação CRM', 4),
('sales-ops', 'Liberar CRM para o time', 'Disponibilizar sistema para uso operacional', 38, 56, 'consultant', 'high', 'Implementação CRM', 4),

-- FASE 5 — PLAYBOOK & PADRONIZAÇÃO (D+39 a D+50)
('sales-ops', 'Criar playbook comercial', 'Desenvolver manual de operação comercial', 39, 57, 'consultant', 'high', 'Playbook & Padronização', 5),
('sales-ops', 'Criar scripts de abordagem', 'Desenvolver roteiros de primeiro contato', 41, 58, 'consultant', 'high', 'Playbook & Padronização', 5),
('sales-ops', 'Criar scripts de follow-up', 'Desenvolver roteiros de acompanhamento', 41, 59, 'consultant', 'high', 'Playbook & Padronização', 5),
('sales-ops', 'Criar regras de uso do CRM', 'Documentar normas de utilização do sistema', 43, 60, 'consultant', 'medium', 'Playbook & Padronização', 5),
('sales-ops', 'Criar checklist de oportunidades', 'Desenvolver lista de verificação por deal', 44, 61, 'consultant', 'medium', 'Playbook & Padronização', 5),
('sales-ops', 'Criar rotina de atualização obrigatória', 'Definir regras de atualização de dados', 45, 62, 'consultant', 'medium', 'Playbook & Padronização', 5),
('sales-ops', 'Criar modelo de reunião semanal', 'Desenvolver pauta padrão de weekly', 46, 63, 'consultant', 'medium', 'Playbook & Padronização', 5),
('sales-ops', 'Validar playbook com cliente', 'Aprovar documentação final', 48, 64, 'consultant', 'high', 'Playbook & Padronização', 5),
('sales-ops', 'Ajustar versão final do playbook', 'Incorporar feedback e finalizar', 50, 65, 'consultant', 'medium', 'Playbook & Padronização', 5),

-- FASE 6 — TREINAMENTO & ADOÇÃO (D+51 a D+60)
('sales-ops', 'Preparar material de treinamento', 'Criar apresentações e materiais didáticos', 51, 66, 'consultant', 'high', 'Treinamento & Adoção', 6),
('sales-ops', 'Treinar time de vendas', 'Conduzir treinamento com vendedores', 53, 67, 'consultant', 'high', 'Treinamento & Adoção', 6),
('sales-ops', 'Treinar liderança comercial', 'Conduzir treinamento com gestores', 54, 68, 'consultant', 'high', 'Treinamento & Adoção', 6),
('sales-ops', 'Tirar dúvidas do time', 'Sessão de Q&A com o time', 55, 69, 'consultant', 'medium', 'Treinamento & Adoção', 6),
('sales-ops', 'Monitorar uso do CRM', 'Acompanhar adoção do sistema', 57, 70, 'consultant', 'high', 'Treinamento & Adoção', 6),
('sales-ops', 'Corrigir desvios de uso', 'Ajustar comportamentos incorretos', 58, 71, 'consultant', 'medium', 'Treinamento & Adoção', 6),
('sales-ops', 'Validar adesão mínima do time', 'Confirmar uso adequado por todos', 60, 72, 'consultant', 'high', 'Treinamento & Adoção', 6),

-- FASE 7 — ESTABILIZAÇÃO & GOVERNANÇA (D+61 a D+90)
('sales-ops', 'Conduzir reunião semanal padrão', 'Iniciar rotina de acompanhamento', 61, 73, 'consultant', 'medium', 'Estabilização & Governança', 7),
('sales-ops', 'Auditar dados do CRM', 'Verificar qualidade dos dados inseridos', 65, 74, 'consultant', 'high', 'Estabilização & Governança', 7),
('sales-ops', 'Ajustar funil conforme dados', 'Otimizar processo baseado em métricas', 70, 75, 'consultant', 'medium', 'Estabilização & Governança', 7),
('sales-ops', 'Avaliar performance inicial', 'Analisar resultados do primeiro ciclo', 75, 76, 'consultant', 'high', 'Estabilização & Governança', 7),
('sales-ops', 'Revisar metas e indicadores', 'Ajustar KPIs conforme aprendizados', 80, 77, 'consultant', 'medium', 'Estabilização & Governança', 7),
('sales-ops', 'Criar plano de melhoria contínua', 'Desenvolver roadmap de evolução', 85, 78, 'consultant', 'high', 'Estabilização & Governança', 7),
('sales-ops', 'Avaliar oportunidades de cross-sell', 'Identificar outros produtos UNV aplicáveis', 88, 79, 'consultant', 'low', 'Estabilização & Governança', 7),
('sales-ops', 'Reunião final de encerramento', 'Encerrar oficialmente o projeto de implementação', 90, 80, 'consultant', 'high', 'Estabilização & Governança', 7);