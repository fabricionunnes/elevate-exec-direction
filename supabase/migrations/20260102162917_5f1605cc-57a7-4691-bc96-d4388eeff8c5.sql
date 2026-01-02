-- 1. Renomear 'default' para 'master' (tarefas padrões que aplicam a todos os produtos)
UPDATE onboarding_task_templates 
SET product_id = 'master' 
WHERE product_id = 'default';

-- 2. Atualizar os offsets das tarefas master (FASE 1 a 5) baseado nos dados originais
-- FASE 1 - Pré-onboarding (D-7 a D0)
UPDATE onboarding_task_templates SET default_days_offset = -7 WHERE product_id = 'master' AND title = 'Enviar link do questionário pré-onboarding';
UPDATE onboarding_task_templates SET default_days_offset = -6 WHERE product_id = 'master' AND title = 'Cobrar preenchimento do questionário';
UPDATE onboarding_task_templates SET default_days_offset = -5 WHERE product_id = 'master' AND title = 'Revisar respostas do questionário';
UPDATE onboarding_task_templates SET default_days_offset = -4 WHERE product_id = 'master' AND title = 'Preparar apresentação de kick-off';
UPDATE onboarding_task_templates SET default_days_offset = -3 WHERE product_id = 'master' AND title = 'Agendar reunião de kick-off';
UPDATE onboarding_task_templates SET default_days_offset = -2 WHERE product_id = 'master' AND title = 'Enviar convite da reunião de kick-off';
UPDATE onboarding_task_templates SET default_days_offset = -1 WHERE product_id = 'master' AND title = 'Enviar lembrete da reunião de kick-off';
UPDATE onboarding_task_templates SET default_days_offset = 0 WHERE product_id = 'master' AND title = 'Realizar reunião de kick-off';
UPDATE onboarding_task_templates SET default_days_offset = 0 WHERE product_id = 'master' AND title = 'Enviar resumo da reunião de kick-off';
UPDATE onboarding_task_templates SET default_days_offset = 0 WHERE product_id = 'master' AND title = 'Criar pasta de documentos do projeto';
UPDATE onboarding_task_templates SET default_days_offset = 0 WHERE product_id = 'master' AND title = 'Enviar cronograma proposto';
UPDATE onboarding_task_templates SET default_days_offset = 0 WHERE product_id = 'master' AND title = 'Alinhar expectativas com stakeholders';
UPDATE onboarding_task_templates SET default_days_offset = 0 WHERE product_id = 'master' AND title = 'Definir canal de comunicação principal';

-- FASE 2 - Kick-off e descoberta (D1 a D7)
UPDATE onboarding_task_templates SET default_days_offset = 1 WHERE product_id = 'master' AND title = 'Coleta de materiais existentes';
UPDATE onboarding_task_templates SET default_days_offset = 1 WHERE product_id = 'master' AND title = 'Análise do cenário atual';
UPDATE onboarding_task_templates SET default_days_offset = 1 WHERE product_id = 'master' AND title = 'Mapeamento de stakeholders';
UPDATE onboarding_task_templates SET default_days_offset = 1 WHERE product_id = 'master' AND title = 'Entrevista com stakeholders chave';
UPDATE onboarding_task_templates SET default_days_offset = 2 WHERE product_id = 'master' AND title = 'Análise de processos atuais';
UPDATE onboarding_task_templates SET default_days_offset = 2 WHERE product_id = 'master' AND title = 'Identificação de gaps e oportunidades';
UPDATE onboarding_task_templates SET default_days_offset = 2 WHERE product_id = 'master' AND title = 'Documentar descobertas iniciais';
UPDATE onboarding_task_templates SET default_days_offset = 2 WHERE product_id = 'master' AND title = 'Revisão de ferramentas existentes';
UPDATE onboarding_task_templates SET default_days_offset = 3 WHERE product_id = 'master' AND title = 'Mapear integrações necessárias';
UPDATE onboarding_task_templates SET default_days_offset = 3 WHERE product_id = 'master' AND title = 'Identificar riscos do projeto';
UPDATE onboarding_task_templates SET default_days_offset = 3 WHERE product_id = 'master' AND title = 'Criar plano de mitigação de riscos';
UPDATE onboarding_task_templates SET default_days_offset = 3 WHERE product_id = 'master' AND title = 'Validar escopo com stakeholders';
UPDATE onboarding_task_templates SET default_days_offset = 4 WHERE product_id = 'master' AND title = 'Apresentar descobertas para equipe';
UPDATE onboarding_task_templates SET default_days_offset = 4 WHERE product_id = 'master' AND title = 'Ajustar cronograma se necessário';
UPDATE onboarding_task_templates SET default_days_offset = 4 WHERE product_id = 'master' AND title = 'Definir métricas de sucesso';
UPDATE onboarding_task_templates SET default_days_offset = 5 WHERE product_id = 'master' AND title = 'Criar documento de requisitos';
UPDATE onboarding_task_templates SET default_days_offset = 5 WHERE product_id = 'master' AND title = 'Priorizar requisitos com cliente';
UPDATE onboarding_task_templates SET default_days_offset = 5 WHERE product_id = 'master' AND title = 'Fechar fase de descoberta';
UPDATE onboarding_task_templates SET default_days_offset = 5 WHERE product_id = 'master' AND title = 'Enviar relatório da fase de descoberta';

-- FASE 3 - Planejamento (D8 a D14)
UPDATE onboarding_task_templates SET default_days_offset = 8 WHERE product_id = 'master' AND title = 'Definir estratégia de implementação';
UPDATE onboarding_task_templates SET default_days_offset = 8 WHERE product_id = 'master' AND title = 'Criar cronograma detalhado';
UPDATE onboarding_task_templates SET default_days_offset = 8 WHERE product_id = 'master' AND title = 'Definir responsáveis por tarefa';
UPDATE onboarding_task_templates SET default_days_offset = 8 WHERE product_id = 'master' AND title = 'Alocar recursos necessários';
UPDATE onboarding_task_templates SET default_days_offset = 9 WHERE product_id = 'master' AND title = 'Criar estrutura de governança';
UPDATE onboarding_task_templates SET default_days_offset = 9 WHERE product_id = 'master' AND title = 'Definir cadência de reuniões';
UPDATE onboarding_task_templates SET default_days_offset = 9 WHERE product_id = 'master' AND title = 'Criar matriz RACI';
UPDATE onboarding_task_templates SET default_days_offset = 9 WHERE product_id = 'master' AND title = 'Definir processos de aprovação';
UPDATE onboarding_task_templates SET default_days_offset = 10 WHERE product_id = 'master' AND title = 'Preparar ambiente de homologação';
UPDATE onboarding_task_templates SET default_days_offset = 10 WHERE product_id = 'master' AND title = 'Configurar acessos e permissões';
UPDATE onboarding_task_templates SET default_days_offset = 10 WHERE product_id = 'master' AND title = 'Criar plano de comunicação';
UPDATE onboarding_task_templates SET default_days_offset = 10 WHERE product_id = 'master' AND title = 'Definir plano de treinamento';
UPDATE onboarding_task_templates SET default_days_offset = 11 WHERE product_id = 'master' AND title = 'Criar materiais de treinamento';
UPDATE onboarding_task_templates SET default_days_offset = 11 WHERE product_id = 'master' AND title = 'Preparar documentação inicial';
UPDATE onboarding_task_templates SET default_days_offset = 12 WHERE product_id = 'master' AND title = 'Validar planejamento com cliente';
UPDATE onboarding_task_templates SET default_days_offset = 12 WHERE product_id = 'master' AND title = 'Ajustar planejamento conforme feedback';
UPDATE onboarding_task_templates SET default_days_offset = 13 WHERE product_id = 'master' AND title = 'Aprovar plano final com stakeholders';
UPDATE onboarding_task_templates SET default_days_offset = 14 WHERE product_id = 'master' AND title = 'Fechar fase de planejamento';
UPDATE onboarding_task_templates SET default_days_offset = 14 WHERE product_id = 'master' AND title = 'Enviar documento de planejamento';

-- FASE 4 - Setup e configuração (D15 a D28)
UPDATE onboarding_task_templates SET default_days_offset = 15 WHERE product_id = 'master' AND title = 'Criar ambiente de produção';
UPDATE onboarding_task_templates SET default_days_offset = 15 WHERE product_id = 'master' AND title = 'Configurar integrações básicas';
UPDATE onboarding_task_templates SET default_days_offset = 16 WHERE product_id = 'master' AND title = 'Importar dados iniciais';
UPDATE onboarding_task_templates SET default_days_offset = 16 WHERE product_id = 'master' AND title = 'Validar dados importados';
UPDATE onboarding_task_templates SET default_days_offset = 17 WHERE product_id = 'master' AND title = 'Configurar usuários e acessos';
UPDATE onboarding_task_templates SET default_days_offset = 17 WHERE product_id = 'master' AND title = 'Configurar notificações';
UPDATE onboarding_task_templates SET default_days_offset = 18 WHERE product_id = 'master' AND title = 'Configurar automações';
UPDATE onboarding_task_templates SET default_days_offset = 18 WHERE product_id = 'master' AND title = 'Testar integrações';
UPDATE onboarding_task_templates SET default_days_offset = 19 WHERE product_id = 'master' AND title = 'Configurar dashboards';
UPDATE onboarding_task_templates SET default_days_offset = 19 WHERE product_id = 'master' AND title = 'Configurar relatórios';
UPDATE onboarding_task_templates SET default_days_offset = 20 WHERE product_id = 'master' AND title = 'Realizar testes de funcionalidade';
UPDATE onboarding_task_templates SET default_days_offset = 20 WHERE product_id = 'master' AND title = 'Corrigir problemas encontrados';
UPDATE onboarding_task_templates SET default_days_offset = 21 WHERE product_id = 'master' AND title = 'Validar configurações com cliente';
UPDATE onboarding_task_templates SET default_days_offset = 22 WHERE product_id = 'master' AND title = 'Ajustar configurações conforme feedback';
UPDATE onboarding_task_templates SET default_days_offset = 23 WHERE product_id = 'master' AND title = 'Preparar ambiente para go-live';
UPDATE onboarding_task_templates SET default_days_offset = 24 WHERE product_id = 'master' AND title = 'Realizar testes finais';
UPDATE onboarding_task_templates SET default_days_offset = 25 WHERE product_id = 'master' AND title = 'Documentar configurações finais';
UPDATE onboarding_task_templates SET default_days_offset = 26 WHERE product_id = 'master' AND title = 'Aprovar ambiente para produção';
UPDATE onboarding_task_templates SET default_days_offset = 28 WHERE product_id = 'master' AND title = 'Fechar fase de setup';

-- FASE 5 - Treinamento e capacitação (D29 a D45)
UPDATE onboarding_task_templates SET default_days_offset = 29 WHERE product_id = 'master' AND title = 'Agendar treinamentos';
UPDATE onboarding_task_templates SET default_days_offset = 29 WHERE product_id = 'master' AND title = 'Enviar convites de treinamento';
UPDATE onboarding_task_templates SET default_days_offset = 30 WHERE product_id = 'master' AND title = 'Realizar treinamento básico - turma 1';
UPDATE onboarding_task_templates SET default_days_offset = 31 WHERE product_id = 'master' AND title = 'Realizar treinamento básico - turma 2';
UPDATE onboarding_task_templates SET default_days_offset = 32 WHERE product_id = 'master' AND title = 'Enviar materiais de apoio';
UPDATE onboarding_task_templates SET default_days_offset = 33 WHERE product_id = 'master' AND title = 'Tirar dúvidas pós-treinamento';
UPDATE onboarding_task_templates SET default_days_offset = 35 WHERE product_id = 'master' AND title = 'Realizar treinamento avançado';
UPDATE onboarding_task_templates SET default_days_offset = 37 WHERE product_id = 'master' AND title = 'Realizar workshop prático';
UPDATE onboarding_task_templates SET default_days_offset = 38 WHERE product_id = 'master' AND title = 'Acompanhar primeiros usos';
UPDATE onboarding_task_templates SET default_days_offset = 39 WHERE product_id = 'master' AND title = 'Corrigir desvios de uso';
UPDATE onboarding_task_templates SET default_days_offset = 40 WHERE product_id = 'master' AND title = 'Realizar sessão de dúvidas';
UPDATE onboarding_task_templates SET default_days_offset = 41 WHERE product_id = 'master' AND title = 'Avaliar progresso de aprendizado';
UPDATE onboarding_task_templates SET default_days_offset = 42 WHERE product_id = 'master' AND title = 'Identificar necessidade de reforço';
UPDATE onboarding_task_templates SET default_days_offset = 43 WHERE product_id = 'master' AND title = 'Realizar treinamento de reforço';
UPDATE onboarding_task_templates SET default_days_offset = 44 WHERE product_id = 'master' AND title = 'Validar competências adquiridas';
UPDATE onboarding_task_templates SET default_days_offset = 45 WHERE product_id = 'master' AND title = 'Fechar fase de treinamento';
UPDATE onboarding_task_templates SET default_days_offset = 45 WHERE product_id = 'master' AND title = 'Entregar certificados de treinamento';

-- 3. Atualizar offsets das tarefas específicas de produto (FASE 6 - Implementação, D46+)
-- Sales Ops (28 tarefas, espaçadas em 2-3 dias cada)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'sales-ops' AND title = 'Mapear processo comercial ideal';
UPDATE onboarding_task_templates SET default_days_offset = 48 WHERE product_id = 'sales-ops' AND title = 'Desenhar funil de vendas';
UPDATE onboarding_task_templates SET default_days_offset = 50 WHERE product_id = 'sales-ops' AND title = 'Definir etapas do funil';
UPDATE onboarding_task_templates SET default_days_offset = 52 WHERE product_id = 'sales-ops' AND title = 'Definir critérios de passagem';
UPDATE onboarding_task_templates SET default_days_offset = 54 WHERE product_id = 'sales-ops' AND title = 'Definir SLAs por etapa';
UPDATE onboarding_task_templates SET default_days_offset = 56 WHERE product_id = 'sales-ops' AND title = 'Definir indicadores por etapa';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'sales-ops' AND title = 'Estruturar CRM do zero';
UPDATE onboarding_task_templates SET default_days_offset = 60 WHERE product_id = 'sales-ops' AND title = 'Criar pipelines no CRM';
UPDATE onboarding_task_templates SET default_days_offset = 62 WHERE product_id = 'sales-ops' AND title = 'Criar campos obrigatórios';
UPDATE onboarding_task_templates SET default_days_offset = 64 WHERE product_id = 'sales-ops' AND title = 'Criar regras de preenchimento';
UPDATE onboarding_task_templates SET default_days_offset = 66 WHERE product_id = 'sales-ops' AND title = 'Criar automações básicas';
UPDATE onboarding_task_templates SET default_days_offset = 68 WHERE product_id = 'sales-ops' AND title = 'Criar dashboards operacionais';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'sales-ops' AND title = 'Criar dashboards gerenciais';
UPDATE onboarding_task_templates SET default_days_offset = 72 WHERE product_id = 'sales-ops' AND title = 'Importar leads existentes';
UPDATE onboarding_task_templates SET default_days_offset = 74 WHERE product_id = 'sales-ops' AND title = 'Testar fluxo completo do funil';
UPDATE onboarding_task_templates SET default_days_offset = 76 WHERE product_id = 'sales-ops' AND title = 'Corrigir erros do CRM';
UPDATE onboarding_task_templates SET default_days_offset = 78 WHERE product_id = 'sales-ops' AND title = 'Criar playbook comercial';
UPDATE onboarding_task_templates SET default_days_offset = 80 WHERE product_id = 'sales-ops' AND title = 'Criar scripts de abordagem';
UPDATE onboarding_task_templates SET default_days_offset = 82 WHERE product_id = 'sales-ops' AND title = 'Criar scripts de follow-up';
UPDATE onboarding_task_templates SET default_days_offset = 84 WHERE product_id = 'sales-ops' AND title = 'Criar regras de uso do CRM';
UPDATE onboarding_task_templates SET default_days_offset = 86 WHERE product_id = 'sales-ops' AND title = 'Criar rotina de gestão comercial';
UPDATE onboarding_task_templates SET default_days_offset = 88 WHERE product_id = 'sales-ops' AND title = 'Criar modelo de reunião semanal';
UPDATE onboarding_task_templates SET default_days_offset = 90 WHERE product_id = 'sales-ops' AND title = 'Criar modelo de reunião mensal';
UPDATE onboarding_task_templates SET default_days_offset = 92 WHERE product_id = 'sales-ops' AND title = 'Treinar time comercial';
UPDATE onboarding_task_templates SET default_days_offset = 94 WHERE product_id = 'sales-ops' AND title = 'Treinar liderança';
UPDATE onboarding_task_templates SET default_days_offset = 96 WHERE product_id = 'sales-ops' AND title = 'Acompanhar primeiros usos';
UPDATE onboarding_task_templates SET default_days_offset = 98 WHERE product_id = 'sales-ops' AND title = 'Corrigir desvios de uso';
UPDATE onboarding_task_templates SET default_days_offset = 100 WHERE product_id = 'sales-ops' AND title = 'Auditar dados semanalmente';

-- Core (10 tarefas, espaçadas em 3 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'core' AND title = 'Definir perfil ideal de candidato';
UPDATE onboarding_task_templates SET default_days_offset = 49 WHERE product_id = 'core' AND title = 'Criar descrição de cargo detalhada';
UPDATE onboarding_task_templates SET default_days_offset = 52 WHERE product_id = 'core' AND title = 'Definir critérios de seleção';
UPDATE onboarding_task_templates SET default_days_offset = 55 WHERE product_id = 'core' AND title = 'Estruturar processo seletivo';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'core' AND title = 'Criar roteiro de entrevistas';
UPDATE onboarding_task_templates SET default_days_offset = 61 WHERE product_id = 'core' AND title = 'Definir testes técnicos';
UPDATE onboarding_task_templates SET default_days_offset = 64 WHERE product_id = 'core' AND title = 'Criar scorecard de avaliação';
UPDATE onboarding_task_templates SET default_days_offset = 67 WHERE product_id = 'core' AND title = 'Treinar entrevistadores';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'core' AND title = 'Acompanhar primeiras entrevistas';
UPDATE onboarding_task_templates SET default_days_offset = 73 WHERE product_id = 'core' AND title = 'Ajustar processo conforme feedback';

-- Control (12 tarefas, espaçadas em 2-3 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'control' AND title = 'Mapear indicadores estratégicos';
UPDATE onboarding_task_templates SET default_days_offset = 48 WHERE product_id = 'control' AND title = 'Definir fontes de dados';
UPDATE onboarding_task_templates SET default_days_offset = 50 WHERE product_id = 'control' AND title = 'Estruturar coleta de dados';
UPDATE onboarding_task_templates SET default_days_offset = 53 WHERE product_id = 'control' AND title = 'Criar dashboards de controle';
UPDATE onboarding_task_templates SET default_days_offset = 56 WHERE product_id = 'control' AND title = 'Configurar alertas e notificações';
UPDATE onboarding_task_templates SET default_days_offset = 59 WHERE product_id = 'control' AND title = 'Definir metas por indicador';
UPDATE onboarding_task_templates SET default_days_offset = 62 WHERE product_id = 'control' AND title = 'Criar rotina de análise';
UPDATE onboarding_task_templates SET default_days_offset = 65 WHERE product_id = 'control' AND title = 'Treinar equipe em análise de dados';
UPDATE onboarding_task_templates SET default_days_offset = 68 WHERE product_id = 'control' AND title = 'Implementar reunião de resultados';
UPDATE onboarding_task_templates SET default_days_offset = 71 WHERE product_id = 'control' AND title = 'Criar plano de ação para desvios';
UPDATE onboarding_task_templates SET default_days_offset = 74 WHERE product_id = 'control' AND title = 'Acompanhar primeiros ciclos';
UPDATE onboarding_task_templates SET default_days_offset = 77 WHERE product_id = 'control' AND title = 'Ajustar indicadores conforme necessário';

-- Sales Acceleration (10 tarefas, espaçadas em 3 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'sales-acceleration' AND title = 'Diagnosticar gargalos do funil';
UPDATE onboarding_task_templates SET default_days_offset = 49 WHERE product_id = 'sales-acceleration' AND title = 'Mapear quick wins';
UPDATE onboarding_task_templates SET default_days_offset = 52 WHERE product_id = 'sales-acceleration' AND title = 'Implementar melhorias rápidas';
UPDATE onboarding_task_templates SET default_days_offset = 55 WHERE product_id = 'sales-acceleration' AND title = 'Otimizar taxa de conversão';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'sales-acceleration' AND title = 'Reduzir ciclo de vendas';
UPDATE onboarding_task_templates SET default_days_offset = 61 WHERE product_id = 'sales-acceleration' AND title = 'Aumentar ticket médio';
UPDATE onboarding_task_templates SET default_days_offset = 64 WHERE product_id = 'sales-acceleration' AND title = 'Implementar upsell/cross-sell';
UPDATE onboarding_task_templates SET default_days_offset = 67 WHERE product_id = 'sales-acceleration' AND title = 'Treinar técnicas avançadas';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'sales-acceleration' AND title = 'Acompanhar resultados';
UPDATE onboarding_task_templates SET default_days_offset = 73 WHERE product_id = 'sales-acceleration' AND title = 'Ajustar estratégias';

-- Sales Force (10 tarefas, espaçadas em 3 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'sales-force' AND title = 'Avaliar performance atual do time';
UPDATE onboarding_task_templates SET default_days_offset = 49 WHERE product_id = 'sales-force' AND title = 'Identificar gaps de competência';
UPDATE onboarding_task_templates SET default_days_offset = 52 WHERE product_id = 'sales-force' AND title = 'Criar plano de desenvolvimento';
UPDATE onboarding_task_templates SET default_days_offset = 55 WHERE product_id = 'sales-force' AND title = 'Implementar treinamentos específicos';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'sales-force' AND title = 'Criar programa de coaching';
UPDATE onboarding_task_templates SET default_days_offset = 61 WHERE product_id = 'sales-force' AND title = 'Implementar role plays';
UPDATE onboarding_task_templates SET default_days_offset = 64 WHERE product_id = 'sales-force' AND title = 'Acompanhar calls reais';
UPDATE onboarding_task_templates SET default_days_offset = 67 WHERE product_id = 'sales-force' AND title = 'Dar feedbacks estruturados';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'sales-force' AND title = 'Medir evolução do time';
UPDATE onboarding_task_templates SET default_days_offset = 73 WHERE product_id = 'sales-force' AND title = 'Ajustar plano de desenvolvimento';

-- Ads (12 tarefas, espaçadas em 2-3 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'ads' AND title = 'Auditoria de contas atuais';
UPDATE onboarding_task_templates SET default_days_offset = 48 WHERE product_id = 'ads' AND title = 'Definir estratégia de mídia';
UPDATE onboarding_task_templates SET default_days_offset = 51 WHERE product_id = 'ads' AND title = 'Estruturar campanhas';
UPDATE onboarding_task_templates SET default_days_offset = 54 WHERE product_id = 'ads' AND title = 'Criar públicos e segmentações';
UPDATE onboarding_task_templates SET default_days_offset = 57 WHERE product_id = 'ads' AND title = 'Desenvolver criativos';
UPDATE onboarding_task_templates SET default_days_offset = 60 WHERE product_id = 'ads' AND title = 'Configurar tracking e pixels';
UPDATE onboarding_task_templates SET default_days_offset = 63 WHERE product_id = 'ads' AND title = 'Lançar campanhas iniciais';
UPDATE onboarding_task_templates SET default_days_offset = 66 WHERE product_id = 'ads' AND title = 'Otimizar performance';
UPDATE onboarding_task_templates SET default_days_offset = 69 WHERE product_id = 'ads' AND title = 'Escalar campanhas vencedoras';
UPDATE onboarding_task_templates SET default_days_offset = 72 WHERE product_id = 'ads' AND title = 'Criar dashboards de mídia';
UPDATE onboarding_task_templates SET default_days_offset = 75 WHERE product_id = 'ads' AND title = 'Treinar equipe em análise de ads';
UPDATE onboarding_task_templates SET default_days_offset = 78 WHERE product_id = 'ads' AND title = 'Implementar rotina de otimização';

-- Social (10 tarefas, espaçadas em 3 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'social' AND title = 'Auditoria de redes sociais';
UPDATE onboarding_task_templates SET default_days_offset = 49 WHERE product_id = 'social' AND title = 'Definir estratégia de conteúdo';
UPDATE onboarding_task_templates SET default_days_offset = 52 WHERE product_id = 'social' AND title = 'Criar calendário editorial';
UPDATE onboarding_task_templates SET default_days_offset = 55 WHERE product_id = 'social' AND title = 'Desenvolver linha editorial';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'social' AND title = 'Criar templates de posts';
UPDATE onboarding_task_templates SET default_days_offset = 61 WHERE product_id = 'social' AND title = 'Produzir conteúdos iniciais';
UPDATE onboarding_task_templates SET default_days_offset = 64 WHERE product_id = 'social' AND title = 'Configurar ferramentas de gestão';
UPDATE onboarding_task_templates SET default_days_offset = 67 WHERE product_id = 'social' AND title = 'Treinar equipe em social';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'social' AND title = 'Implementar rotina de publicação';
UPDATE onboarding_task_templates SET default_days_offset = 73 WHERE product_id = 'social' AND title = 'Criar relatório de métricas';

-- Finance (9 tarefas, espaçadas em 3 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'finance' AND title = 'Mapear processos financeiros';
UPDATE onboarding_task_templates SET default_days_offset = 49 WHERE product_id = 'finance' AND title = 'Estruturar DRE gerencial';
UPDATE onboarding_task_templates SET default_days_offset = 52 WHERE product_id = 'finance' AND title = 'Criar fluxo de caixa projetado';
UPDATE onboarding_task_templates SET default_days_offset = 55 WHERE product_id = 'finance' AND title = 'Implementar controles financeiros';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'finance' AND title = 'Criar dashboards financeiros';
UPDATE onboarding_task_templates SET default_days_offset = 61 WHERE product_id = 'finance' AND title = 'Definir indicadores financeiros';
UPDATE onboarding_task_templates SET default_days_offset = 64 WHERE product_id = 'finance' AND title = 'Treinar gestão financeira';
UPDATE onboarding_task_templates SET default_days_offset = 67 WHERE product_id = 'finance' AND title = 'Implementar rotina de análise';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'finance' AND title = 'Criar relatório gerencial mensal';

-- People (9 tarefas, espaçadas em 3 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'people' AND title = 'Mapear organograma atual';
UPDATE onboarding_task_templates SET default_days_offset = 49 WHERE product_id = 'people' AND title = 'Definir estrutura ideal';
UPDATE onboarding_task_templates SET default_days_offset = 52 WHERE product_id = 'people' AND title = 'Criar descrições de cargo';
UPDATE onboarding_task_templates SET default_days_offset = 55 WHERE product_id = 'people' AND title = 'Implementar avaliação de desempenho';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'people' AND title = 'Criar plano de carreira';
UPDATE onboarding_task_templates SET default_days_offset = 61 WHERE product_id = 'people' AND title = 'Estruturar programa de feedback';
UPDATE onboarding_task_templates SET default_days_offset = 64 WHERE product_id = 'people' AND title = 'Implementar one-on-ones';
UPDATE onboarding_task_templates SET default_days_offset = 67 WHERE product_id = 'people' AND title = 'Treinar liderança em gestão';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'people' AND title = 'Acompanhar clima organizacional';

-- Safe (7 tarefas, espaçadas em 4 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'safe' AND title = 'Mapear riscos jurídicos';
UPDATE onboarding_task_templates SET default_days_offset = 50 WHERE product_id = 'safe' AND title = 'Revisar contratos existentes';
UPDATE onboarding_task_templates SET default_days_offset = 54 WHERE product_id = 'safe' AND title = 'Criar modelos de contrato';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'safe' AND title = 'Implementar processos de compliance';
UPDATE onboarding_task_templates SET default_days_offset = 62 WHERE product_id = 'safe' AND title = 'Treinar equipe em compliance';
UPDATE onboarding_task_templates SET default_days_offset = 66 WHERE product_id = 'safe' AND title = 'Criar políticas internas';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'safe' AND title = 'Implementar rotina de auditoria';

-- AI Sales System (10 tarefas, espaçadas em 3 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'ai-sales-system' AND title = 'Mapear processos automatizáveis';
UPDATE onboarding_task_templates SET default_days_offset = 49 WHERE product_id = 'ai-sales-system' AND title = 'Definir fluxos de automação';
UPDATE onboarding_task_templates SET default_days_offset = 52 WHERE product_id = 'ai-sales-system' AND title = 'Configurar chatbots e IA';
UPDATE onboarding_task_templates SET default_days_offset = 55 WHERE product_id = 'ai-sales-system' AND title = 'Integrar ferramentas de IA';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'ai-sales-system' AND title = 'Treinar modelos de IA';
UPDATE onboarding_task_templates SET default_days_offset = 61 WHERE product_id = 'ai-sales-system' AND title = 'Testar automações';
UPDATE onboarding_task_templates SET default_days_offset = 64 WHERE product_id = 'ai-sales-system' AND title = 'Otimizar respostas da IA';
UPDATE onboarding_task_templates SET default_days_offset = 67 WHERE product_id = 'ai-sales-system' AND title = 'Lançar em produção';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'ai-sales-system' AND title = 'Monitorar performance';
UPDATE onboarding_task_templates SET default_days_offset = 73 WHERE product_id = 'ai-sales-system' AND title = 'Ajustar automações';

-- Execution Partnership (10 tarefas, espaçadas em 3 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'execution-partnership' AND title = 'Definir escopo da parceria';
UPDATE onboarding_task_templates SET default_days_offset = 49 WHERE product_id = 'execution-partnership' AND title = 'Criar SLA de atendimento';
UPDATE onboarding_task_templates SET default_days_offset = 52 WHERE product_id = 'execution-partnership' AND title = 'Definir entregas mensais';
UPDATE onboarding_task_templates SET default_days_offset = 55 WHERE product_id = 'execution-partnership' AND title = 'Estruturar governança';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'execution-partnership' AND title = 'Criar rituais de acompanhamento';
UPDATE onboarding_task_templates SET default_days_offset = 61 WHERE product_id = 'execution-partnership' AND title = 'Implementar primeiro ciclo';
UPDATE onboarding_task_templates SET default_days_offset = 64 WHERE product_id = 'execution-partnership' AND title = 'Revisar entregas';
UPDATE onboarding_task_templates SET default_days_offset = 67 WHERE product_id = 'execution-partnership' AND title = 'Ajustar escopo se necessário';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'execution-partnership' AND title = 'Validar satisfação do cliente';
UPDATE onboarding_task_templates SET default_days_offset = 73 WHERE product_id = 'execution-partnership' AND title = 'Planejar próximo ciclo';

-- Growth Room (7 tarefas, espaçadas em 4 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'growth-room' AND title = 'Definir objetivo do grupo';
UPDATE onboarding_task_templates SET default_days_offset = 50 WHERE product_id = 'growth-room' AND title = 'Selecionar participantes';
UPDATE onboarding_task_templates SET default_days_offset = 54 WHERE product_id = 'growth-room' AND title = 'Criar agenda de encontros';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'growth-room' AND title = 'Preparar materiais';
UPDATE onboarding_task_templates SET default_days_offset = 62 WHERE product_id = 'growth-room' AND title = 'Realizar primeiro encontro';
UPDATE onboarding_task_templates SET default_days_offset = 66 WHERE product_id = 'growth-room' AND title = 'Coletar feedback';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'growth-room' AND title = 'Ajustar dinâmica';

-- Partners (7 tarefas, espaçadas em 4 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'partners' AND title = 'Definir perfil de parceiro ideal';
UPDATE onboarding_task_templates SET default_days_offset = 50 WHERE product_id = 'partners' AND title = 'Criar programa de parceria';
UPDATE onboarding_task_templates SET default_days_offset = 54 WHERE product_id = 'partners' AND title = 'Estruturar benefícios';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'partners' AND title = 'Criar materiais de apoio';
UPDATE onboarding_task_templates SET default_days_offset = 62 WHERE product_id = 'partners' AND title = 'Onboard primeiros parceiros';
UPDATE onboarding_task_templates SET default_days_offset = 66 WHERE product_id = 'partners' AND title = 'Acompanhar performance';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'partners' AND title = 'Ajustar programa';

-- Mastermind (7 tarefas, espaçadas em 4 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'mastermind' AND title = 'Definir formato das sessões';
UPDATE onboarding_task_templates SET default_days_offset = 50 WHERE product_id = 'mastermind' AND title = 'Criar agenda anual';
UPDATE onboarding_task_templates SET default_days_offset = 54 WHERE product_id = 'mastermind' AND title = 'Preparar primeira sessão';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'mastermind' AND title = 'Realizar sessão inaugural';
UPDATE onboarding_task_templates SET default_days_offset = 62 WHERE product_id = 'mastermind' AND title = 'Coletar compromissos';
UPDATE onboarding_task_templates SET default_days_offset = 66 WHERE product_id = 'mastermind' AND title = 'Acompanhar execução';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'mastermind' AND title = 'Preparar próxima sessão';

-- Leadership (8 tarefas, espaçadas em 3 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'leadership' AND title = 'Avaliar competências atuais';
UPDATE onboarding_task_templates SET default_days_offset = 49 WHERE product_id = 'leadership' AND title = 'Definir plano de desenvolvimento';
UPDATE onboarding_task_templates SET default_days_offset = 52 WHERE product_id = 'leadership' AND title = 'Realizar sessões de coaching';
UPDATE onboarding_task_templates SET default_days_offset = 55 WHERE product_id = 'leadership' AND title = 'Implementar feedbacks 360';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'leadership' AND title = 'Acompanhar evolução';
UPDATE onboarding_task_templates SET default_days_offset = 61 WHERE product_id = 'leadership' AND title = 'Ajustar plano se necessário';
UPDATE onboarding_task_templates SET default_days_offset = 64 WHERE product_id = 'leadership' AND title = 'Validar competências adquiridas';
UPDATE onboarding_task_templates SET default_days_offset = 67 WHERE product_id = 'leadership' AND title = 'Criar plano de manutenção';

-- Fractional CRO (9 tarefas, espaçadas em 3 dias)
UPDATE onboarding_task_templates SET default_days_offset = 46 WHERE product_id = 'fractional-cro' AND title = 'Diagnóstico inicial da operação';
UPDATE onboarding_task_templates SET default_days_offset = 49 WHERE product_id = 'fractional-cro' AND title = 'Definir prioridades estratégicas';
UPDATE onboarding_task_templates SET default_days_offset = 52 WHERE product_id = 'fractional-cro' AND title = 'Criar plano 90 dias';
UPDATE onboarding_task_templates SET default_days_offset = 55 WHERE product_id = 'fractional-cro' AND title = 'Implementar governança';
UPDATE onboarding_task_templates SET default_days_offset = 58 WHERE product_id = 'fractional-cro' AND title = 'Acompanhar time comercial';
UPDATE onboarding_task_templates SET default_days_offset = 61 WHERE product_id = 'fractional-cro' AND title = 'Liderar reuniões de resultados';
UPDATE onboarding_task_templates SET default_days_offset = 64 WHERE product_id = 'fractional-cro' AND title = 'Revisar métricas mensais';
UPDATE onboarding_task_templates SET default_days_offset = 67 WHERE product_id = 'fractional-cro' AND title = 'Ajustar estratégias';
UPDATE onboarding_task_templates SET default_days_offset = 70 WHERE product_id = 'fractional-cro' AND title = 'Reportar para diretoria';