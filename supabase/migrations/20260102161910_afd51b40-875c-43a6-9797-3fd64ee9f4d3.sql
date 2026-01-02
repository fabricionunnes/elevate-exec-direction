
-- =============================================
-- FASE 6 — IMPLEMENTAÇÃO ESPECÍFICA POR PRODUTO
-- =============================================

-- UNV SALES OPS (product_id: sales-ops)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('sales-ops', 'Mapear processo comercial ideal', 'Implementação', 6, 1, 'high', 'consultant'),
('sales-ops', 'Desenhar funil de vendas', 'Implementação', 6, 2, 'high', 'consultant'),
('sales-ops', 'Definir etapas do funil', 'Implementação', 6, 3, 'high', 'consultant'),
('sales-ops', 'Definir critérios de passagem', 'Implementação', 6, 4, 'high', 'consultant'),
('sales-ops', 'Definir SLAs por etapa', 'Implementação', 6, 5, 'high', 'consultant'),
('sales-ops', 'Definir indicadores por etapa', 'Implementação', 6, 6, 'high', 'consultant'),
('sales-ops', 'Estruturar CRM do zero', 'Implementação', 6, 7, 'high', 'consultant'),
('sales-ops', 'Criar pipelines no CRM', 'Implementação', 6, 8, 'high', 'consultant'),
('sales-ops', 'Criar campos obrigatórios', 'Implementação', 6, 9, 'high', 'consultant'),
('sales-ops', 'Criar regras de preenchimento', 'Implementação', 6, 10, 'medium', 'consultant'),
('sales-ops', 'Criar automações básicas', 'Implementação', 6, 11, 'high', 'consultant'),
('sales-ops', 'Criar dashboards operacionais', 'Implementação', 6, 12, 'high', 'consultant'),
('sales-ops', 'Criar dashboards gerenciais', 'Implementação', 6, 13, 'high', 'consultant'),
('sales-ops', 'Importar leads existentes', 'Implementação', 6, 14, 'medium', 'consultant'),
('sales-ops', 'Testar fluxo completo do funil', 'Implementação', 6, 15, 'high', 'consultant'),
('sales-ops', 'Corrigir erros do CRM', 'Implementação', 6, 16, 'high', 'consultant'),
('sales-ops', 'Criar playbook comercial', 'Implementação', 6, 17, 'high', 'consultant'),
('sales-ops', 'Criar scripts de abordagem', 'Implementação', 6, 18, 'high', 'consultant'),
('sales-ops', 'Criar scripts de follow-up', 'Implementação', 6, 19, 'high', 'consultant'),
('sales-ops', 'Criar regras de uso do CRM', 'Implementação', 6, 20, 'medium', 'consultant'),
('sales-ops', 'Criar rotina de gestão comercial', 'Implementação', 6, 21, 'high', 'consultant'),
('sales-ops', 'Criar modelo de reunião semanal', 'Implementação', 6, 22, 'medium', 'consultant'),
('sales-ops', 'Criar modelo de reunião mensal', 'Implementação', 6, 23, 'medium', 'consultant'),
('sales-ops', 'Treinar time comercial', 'Implementação', 6, 24, 'high', 'consultant'),
('sales-ops', 'Treinar liderança', 'Implementação', 6, 25, 'high', 'consultant'),
('sales-ops', 'Acompanhar primeiros usos', 'Implementação', 6, 26, 'high', 'cs'),
('sales-ops', 'Corrigir desvios de uso', 'Implementação', 6, 27, 'high', 'consultant'),
('sales-ops', 'Auditar dados semanalmente', 'Implementação', 6, 28, 'high', 'cs');

-- UNV CORE (product_id: core)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('core', 'Criar funil inicial', 'Implementação', 6, 1, 'high', 'consultant'),
('core', 'Definir etapas do funil', 'Implementação', 6, 2, 'high', 'consultant'),
('core', 'Criar metas comerciais', 'Implementação', 6, 3, 'high', 'consultant'),
('core', 'Configurar CRM básico', 'Implementação', 6, 4, 'high', 'consultant'),
('core', 'Criar rotina de prospecção', 'Implementação', 6, 5, 'high', 'consultant'),
('core', 'Criar scripts de abordagem', 'Implementação', 6, 6, 'high', 'consultant'),
('core', 'Treinar técnicas de vendas', 'Implementação', 6, 7, 'high', 'consultant'),
('core', 'Implementar follow-up estruturado', 'Implementação', 6, 8, 'high', 'consultant'),
('core', 'Criar dashboard básico', 'Implementação', 6, 9, 'high', 'consultant'),
('core', 'Validar primeiros resultados', 'Implementação', 6, 10, 'high', 'consultant');

-- UNV CONTROL (product_id: control)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('control', 'Definir KPIs comerciais finais', 'Implementação', 6, 1, 'high', 'consultant'),
('control', 'Definir KPIs de produtividade do time', 'Implementação', 6, 2, 'high', 'consultant'),
('control', 'Definir metas individuais por função', 'Implementação', 6, 3, 'high', 'consultant'),
('control', 'Definir metas coletivas do time', 'Implementação', 6, 4, 'high', 'consultant'),
('control', 'Criar rotina semanal de cobrança', 'Implementação', 6, 5, 'high', 'consultant'),
('control', 'Criar pauta padrão de reunião semanal', 'Implementação', 6, 6, 'medium', 'consultant'),
('control', 'Criar pauta padrão de reunião mensal', 'Implementação', 6, 7, 'medium', 'consultant'),
('control', 'Criar painéis de acompanhamento', 'Implementação', 6, 8, 'high', 'consultant'),
('control', 'Criar dashboard de gestão', 'Implementação', 6, 9, 'high', 'consultant'),
('control', 'Implementar rituais de accountability', 'Implementação', 6, 10, 'high', 'consultant'),
('control', 'Treinar liderança em gestão', 'Implementação', 6, 11, 'high', 'consultant'),
('control', 'Validar execução das rotinas', 'Implementação', 6, 12, 'high', 'cs');

-- UNV SALES ACCELERATION (product_id: sales-acceleration)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('sales-acceleration', 'Analisar gargalos do funil', 'Implementação', 6, 1, 'high', 'consultant'),
('sales-acceleration', 'Otimizar processo de qualificação', 'Implementação', 6, 2, 'high', 'consultant'),
('sales-acceleration', 'Otimizar processo de fechamento', 'Implementação', 6, 3, 'high', 'consultant'),
('sales-acceleration', 'Implementar técnicas avançadas de vendas', 'Implementação', 6, 4, 'high', 'consultant'),
('sales-acceleration', 'Criar cadências de prospecção', 'Implementação', 6, 5, 'high', 'consultant'),
('sales-acceleration', 'Otimizar scripts existentes', 'Implementação', 6, 6, 'high', 'consultant'),
('sales-acceleration', 'Criar estratégia de upsell', 'Implementação', 6, 7, 'high', 'consultant'),
('sales-acceleration', 'Criar estratégia de cross-sell', 'Implementação', 6, 8, 'high', 'consultant'),
('sales-acceleration', 'Treinar time em técnicas avançadas', 'Implementação', 6, 9, 'high', 'consultant'),
('sales-acceleration', 'Medir e ajustar conversões', 'Implementação', 6, 10, 'high', 'consultant');

-- UNV SALES FORCE (product_id: sales-force)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('sales-force', 'Definir perfil ideal de vendedor', 'Implementação', 6, 1, 'high', 'consultant'),
('sales-force', 'Criar processo seletivo estruturado', 'Implementação', 6, 2, 'high', 'consultant'),
('sales-force', 'Criar onboarding de vendedores', 'Implementação', 6, 3, 'high', 'consultant'),
('sales-force', 'Definir plano de carreira', 'Implementação', 6, 4, 'high', 'consultant'),
('sales-force', 'Criar política de remuneração', 'Implementação', 6, 5, 'high', 'consultant'),
('sales-force', 'Definir metas por cargo', 'Implementação', 6, 6, 'high', 'consultant'),
('sales-force', 'Criar programa de treinamento contínuo', 'Implementação', 6, 7, 'high', 'consultant'),
('sales-force', 'Implementar avaliação de desempenho', 'Implementação', 6, 8, 'high', 'consultant'),
('sales-force', 'Criar rituais de desenvolvimento', 'Implementação', 6, 9, 'medium', 'consultant'),
('sales-force', 'Validar capacidade do time', 'Implementação', 6, 10, 'high', 'consultant');

-- UNV ADS (product_id: ads)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('ads', 'Analisar oferta antes de rodar tráfego', 'Implementação', 6, 1, 'high', 'consultant'),
('ads', 'Definir ICP para campanhas', 'Implementação', 6, 2, 'high', 'consultant'),
('ads', 'Criar estrutura de campanhas', 'Implementação', 6, 3, 'high', 'consultant'),
('ads', 'Criar variações de anúncios', 'Implementação', 6, 4, 'high', 'consultant'),
('ads', 'Criar páginas de destino', 'Implementação', 6, 5, 'high', 'consultant'),
('ads', 'Configurar eventos e rastreamento', 'Implementação', 6, 6, 'high', 'consultant'),
('ads', 'Subir campanhas iniciais', 'Implementação', 6, 7, 'high', 'consultant'),
('ads', 'Monitorar CPA e CPL', 'Implementação', 6, 8, 'high', 'cs'),
('ads', 'Otimizar criativos', 'Implementação', 6, 9, 'high', 'consultant'),
('ads', 'Otimizar públicos', 'Implementação', 6, 10, 'high', 'consultant'),
('ads', 'Escalar campanhas vencedoras', 'Implementação', 6, 11, 'high', 'consultant'),
('ads', 'Gerar relatório mensal', 'Implementação', 6, 12, 'high', 'cs');

-- UNV SOCIAL (product_id: social)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('social', 'Definir posicionamento nas redes', 'Implementação', 6, 1, 'high', 'consultant'),
('social', 'Criar calendário editorial', 'Implementação', 6, 2, 'high', 'consultant'),
('social', 'Definir pilares de conteúdo', 'Implementação', 6, 3, 'high', 'consultant'),
('social', 'Criar templates visuais', 'Implementação', 6, 4, 'high', 'consultant'),
('social', 'Criar rotina de postagem', 'Implementação', 6, 5, 'high', 'consultant'),
('social', 'Criar estratégia de engajamento', 'Implementação', 6, 6, 'high', 'consultant'),
('social', 'Criar estratégia de Stories', 'Implementação', 6, 7, 'medium', 'consultant'),
('social', 'Criar estratégia de Reels', 'Implementação', 6, 8, 'medium', 'consultant'),
('social', 'Monitorar métricas de alcance', 'Implementação', 6, 9, 'high', 'cs'),
('social', 'Gerar relatório mensal', 'Implementação', 6, 10, 'high', 'cs');

-- UNV FINANCE (product_id: finance)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('finance', 'Mapear fluxo de caixa atual', 'Implementação', 6, 1, 'high', 'consultant'),
('finance', 'Criar dashboard financeiro', 'Implementação', 6, 2, 'high', 'consultant'),
('finance', 'Definir indicadores financeiros', 'Implementação', 6, 3, 'high', 'consultant'),
('finance', 'Criar rotina de análise financeira', 'Implementação', 6, 4, 'high', 'consultant'),
('finance', 'Otimizar margem de contribuição', 'Implementação', 6, 5, 'high', 'consultant'),
('finance', 'Criar projeções financeiras', 'Implementação', 6, 6, 'high', 'consultant'),
('finance', 'Treinar liderança em finanças', 'Implementação', 6, 7, 'high', 'consultant'),
('finance', 'Implementar controle de custos', 'Implementação', 6, 8, 'high', 'consultant'),
('finance', 'Validar saúde financeira', 'Implementação', 6, 9, 'high', 'consultant');

-- UNV PEOPLE (product_id: people)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('people', 'Mapear organograma atual', 'Implementação', 6, 1, 'high', 'consultant'),
('people', 'Definir descrições de cargo', 'Implementação', 6, 2, 'high', 'consultant'),
('people', 'Criar política de RH', 'Implementação', 6, 3, 'high', 'consultant'),
('people', 'Implementar avaliação de desempenho', 'Implementação', 6, 4, 'high', 'consultant'),
('people', 'Criar plano de desenvolvimento', 'Implementação', 6, 5, 'high', 'consultant'),
('people', 'Definir política de remuneração', 'Implementação', 6, 6, 'high', 'consultant'),
('people', 'Criar processo de feedback', 'Implementação', 6, 7, 'high', 'consultant'),
('people', 'Treinar liderança em gestão de pessoas', 'Implementação', 6, 8, 'high', 'consultant'),
('people', 'Validar clima organizacional', 'Implementação', 6, 9, 'high', 'consultant');

-- UNV SAFE (product_id: safe)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('safe', 'Mapear riscos jurídicos', 'Implementação', 6, 1, 'high', 'consultant'),
('safe', 'Revisar contratos existentes', 'Implementação', 6, 2, 'high', 'consultant'),
('safe', 'Criar contratos padrão', 'Implementação', 6, 3, 'high', 'consultant'),
('safe', 'Implementar LGPD', 'Implementação', 6, 4, 'high', 'consultant'),
('safe', 'Criar políticas de compliance', 'Implementação', 6, 5, 'high', 'consultant'),
('safe', 'Treinar equipe em compliance', 'Implementação', 6, 6, 'high', 'consultant'),
('safe', 'Validar conformidade jurídica', 'Implementação', 6, 7, 'high', 'consultant');

-- UNV AI SALES SYSTEM (product_id: ai-sales-system)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('ai-sales-system', 'Definir objetivos da IA no negócio', 'Implementação', 6, 1, 'high', 'consultant'),
('ai-sales-system', 'Definir fluxos de conversa', 'Implementação', 6, 2, 'high', 'consultant'),
('ai-sales-system', 'Criar agentes de IA personalizados', 'Implementação', 6, 3, 'high', 'consultant'),
('ai-sales-system', 'Treinar agentes com dados reais', 'Implementação', 6, 4, 'high', 'consultant'),
('ai-sales-system', 'Integrar WhatsApp', 'Implementação', 6, 5, 'high', 'consultant'),
('ai-sales-system', 'Integrar Instagram', 'Implementação', 6, 6, 'high', 'consultant'),
('ai-sales-system', 'Testar fluxos de conversa', 'Implementação', 6, 7, 'high', 'consultant'),
('ai-sales-system', 'Ajustar prompts e regras', 'Implementação', 6, 8, 'medium', 'consultant'),
('ai-sales-system', 'Monitorar performance da IA', 'Implementação', 6, 9, 'high', 'cs'),
('ai-sales-system', 'Otimizar eficiência', 'Implementação', 6, 10, 'medium', 'consultant');

-- UNV EXECUTION PARTNERSHIP (product_id: execution-partnership)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('execution-partnership', 'Definir escopo da parceria', 'Implementação', 6, 1, 'high', 'consultant'),
('execution-partnership', 'Criar plano de execução conjunto', 'Implementação', 6, 2, 'high', 'consultant'),
('execution-partnership', 'Definir responsabilidades UNV', 'Implementação', 6, 3, 'high', 'consultant'),
('execution-partnership', 'Definir responsabilidades cliente', 'Implementação', 6, 4, 'high', 'consultant'),
('execution-partnership', 'Criar rituais de acompanhamento', 'Implementação', 6, 5, 'high', 'consultant'),
('execution-partnership', 'Implementar frentes prioritárias', 'Implementação', 6, 6, 'high', 'consultant'),
('execution-partnership', 'Medir resultados semanalmente', 'Implementação', 6, 7, 'high', 'cs'),
('execution-partnership', 'Ajustar plano conforme resultados', 'Implementação', 6, 8, 'high', 'consultant'),
('execution-partnership', 'Validar ROI da parceria', 'Implementação', 6, 9, 'high', 'consultant'),
('execution-partnership', 'Renovar ou expandir escopo', 'Implementação', 6, 10, 'high', 'consultant');

-- UNV GROWTH ROOM (product_id: growth-room)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('growth-room', 'Onboarding na comunidade', 'Implementação', 6, 1, 'high', 'cs'),
('growth-room', 'Apresentar recursos disponíveis', 'Implementação', 6, 2, 'high', 'cs'),
('growth-room', 'Definir objetivos do membro', 'Implementação', 6, 3, 'high', 'consultant'),
('growth-room', 'Criar plano de participação', 'Implementação', 6, 4, 'high', 'consultant'),
('growth-room', 'Acompanhar primeiras interações', 'Implementação', 6, 5, 'high', 'cs'),
('growth-room', 'Conectar com outros membros', 'Implementação', 6, 6, 'medium', 'cs'),
('growth-room', 'Validar aproveitamento', 'Implementação', 6, 7, 'high', 'consultant');

-- UNV PARTNERS (product_id: partners)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('partners', 'Onboarding como parceiro', 'Implementação', 6, 1, 'high', 'cs'),
('partners', 'Treinar metodologia UNV', 'Implementação', 6, 2, 'high', 'consultant'),
('partners', 'Definir modelo de atuação', 'Implementação', 6, 3, 'high', 'consultant'),
('partners', 'Criar materiais de apoio', 'Implementação', 6, 4, 'high', 'consultant'),
('partners', 'Definir comissionamento', 'Implementação', 6, 5, 'high', 'consultant'),
('partners', 'Acompanhar primeiros clientes', 'Implementação', 6, 6, 'high', 'cs'),
('partners', 'Validar qualidade de entrega', 'Implementação', 6, 7, 'high', 'consultant');

-- UNV MASTERMIND (product_id: mastermind)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('mastermind', 'Onboarding no grupo', 'Implementação', 6, 1, 'high', 'cs'),
('mastermind', 'Apresentar membros do grupo', 'Implementação', 6, 2, 'high', 'cs'),
('mastermind', 'Definir desafio principal', 'Implementação', 6, 3, 'high', 'consultant'),
('mastermind', 'Criar plano de ação inicial', 'Implementação', 6, 4, 'high', 'consultant'),
('mastermind', 'Acompanhar participação nas reuniões', 'Implementação', 6, 5, 'high', 'cs'),
('mastermind', 'Facilitar conexões estratégicas', 'Implementação', 6, 6, 'medium', 'consultant'),
('mastermind', 'Validar evolução do empresário', 'Implementação', 6, 7, 'high', 'consultant');

-- UNV LEADERSHIP (product_id: leadership)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('leadership', 'Avaliar perfil de liderança', 'Implementação', 6, 1, 'high', 'consultant'),
('leadership', 'Definir gaps de desenvolvimento', 'Implementação', 6, 2, 'high', 'consultant'),
('leadership', 'Criar plano de desenvolvimento', 'Implementação', 6, 3, 'high', 'consultant'),
('leadership', 'Treinar gestão de pessoas', 'Implementação', 6, 4, 'high', 'consultant'),
('leadership', 'Treinar gestão de resultados', 'Implementação', 6, 5, 'high', 'consultant'),
('leadership', 'Implementar rituais de liderança', 'Implementação', 6, 6, 'high', 'consultant'),
('leadership', 'Acompanhar evolução do líder', 'Implementação', 6, 7, 'high', 'cs'),
('leadership', 'Validar impacto no time', 'Implementação', 6, 8, 'high', 'consultant');

-- UNV FRACTIONAL CRO (product_id: fractional-cro)
INSERT INTO onboarding_task_templates (product_id, title, phase, phase_order, sort_order, priority, responsible_role) VALUES
('fractional-cro', 'Definir escopo de atuação', 'Implementação', 6, 1, 'high', 'consultant'),
('fractional-cro', 'Criar plano estratégico comercial', 'Implementação', 6, 2, 'high', 'consultant'),
('fractional-cro', 'Definir metas e KPIs', 'Implementação', 6, 3, 'high', 'consultant'),
('fractional-cro', 'Implementar gestão do time', 'Implementação', 6, 4, 'high', 'consultant'),
('fractional-cro', 'Criar rituais de liderança', 'Implementação', 6, 5, 'high', 'consultant'),
('fractional-cro', 'Acompanhar resultados semanalmente', 'Implementação', 6, 6, 'high', 'consultant'),
('fractional-cro', 'Reportar ao CEO', 'Implementação', 6, 7, 'high', 'consultant'),
('fractional-cro', 'Ajustar estratégia conforme resultados', 'Implementação', 6, 8, 'high', 'consultant'),
('fractional-cro', 'Validar ROI da atuação', 'Implementação', 6, 9, 'high', 'consultant');
