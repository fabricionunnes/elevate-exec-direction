-- UNV AI Sprint (pedido do Fabrício, 02/10/2026).
-- Produto novo: 2 reuniões individuais de 1h com o Fabrício, quinzenais, pra implementar
-- IA (Claude, ChatGPT e afins) em gestão, comercial e marketing. O cliente executa com a
-- tela compartilhada, o Fabrício conduz. Entre as reuniões, suporte no grupo de WhatsApp.
-- Ciclo de ~35 dias: preparação, Reunião 1 (D+7), suporte, Reunião 2 (D+21), encerramento.
-- Serviço no catálogo (onboarding_services) + templates de tarefas por fase. As tarefas
-- globais (Jornada UNV) continuam vindo do trigger seed_global_project_tasks.
-- Idempotente: roda de novo sem duplicar serviço nem template.

insert into public.onboarding_services (name, slug, description, list_price, recurrence, is_active)
select
  'UNV AI Sprint',
  'ai-sprint',
  'Implementação de IA lado a lado com o Fabrício: 2 reuniões individuais quinzenais de 1h + suporte no WhatsApp entre as reuniões',
  4997,
  'unica',
  true
where not exists (
  select 1 from public.onboarding_services where slug = 'ai-sprint' and tenant_id is null
);

insert into public.onboarding_task_templates
  (product_id, title, description, default_days_offset, sort_order, priority, phase, phase_order, responsible_role, is_internal)
select v.product_id, v.title, v.description, v.days, v.sort_order, v.priority, v.phase, v.phase_order, v.role, v.is_internal
from (values
  -- Fase 1: Preparação (antes da Reunião 1)
  ('ai-sprint','Enviar diagnóstico de IA ao cliente',
   'Formulário curto: rotinas que mais tomam tempo em gestão, comercial e marketing; ferramentas que já usa; quem do time vai participar.',
   1, 1,'high','Preparação',1,'consultant',false),
  ('ai-sprint','Configurar grupo de suporte AI Sprint no WhatsApp',
   'Fixar mensagem com regras: horário de atendimento, como mandar dúvida (print + o que tentou), datas das 2 reuniões.',
   1, 2,'high','Preparação',1,'consultant',true),
  ('ai-sprint','Agendar Reunião 1 e Reunião 2 (quinzenal)',
   'Duas reuniões de 1h com o Fabrício, intervalo de 15 dias. Link de videochamada com compartilhamento de tela.',
   2, 3,'high','Preparação',1,'consultant',false),
  ('ai-sprint','Cliente criar contas nas ferramentas de IA',
   'Claude e/ou ChatGPT (plano pago recomendado) e acessos às ferramentas que serão integradas (CRM, planilhas, e-mail). Chegar na Reunião 1 com tudo logado.',
   5, 4,'high','Preparação',1,'client',false),
  ('ai-sprint','Analisar diagnóstico e escolher os 3 casos de uso prioritários',
   'Priorizar pelo filtro: o que economiza mais horas, o que gera previsibilidade, o que aumenta margem. Um caso por área (gestão, comercial, marketing) quando fizer sentido.',
   6, 5,'high','Preparação',1,'consultant',true),

  -- Fase 2: Reunião 1
  ('ai-sprint','Realizar Reunião 1: mapa de IA + primeiras implementações',
   '1h, tela compartilhada. Apresentar o mapa de IA da empresa, montar com o cliente o primeiro caso de uso funcionando (prompts, projetos/GPTs, rotina). O cliente clica, o Fabrício conduz.',
   7, 6,'urgent','Reunião 1',2,'consultant',false),
  ('ai-sprint','Enviar resumo e plano de ação da Reunião 1 no grupo',
   'O que foi implementado, prompts usados, tarefas do cliente até a Reunião 2 com prazo.',
   8, 7,'high','Reunião 1',2,'consultant',false),
  ('ai-sprint','Cliente implementar os casos de uso definidos na Reunião 1',
   'Colocar em uso no dia a dia e registrar no grupo o que travou.',
   14, 8,'high','Reunião 1',2,'client',false),

  -- Fase 3: Suporte entre reuniões
  ('ai-sprint','Check-in no grupo: uso das implementações (D+3 da Reunião 1)',
   'Perguntar o que já está rodando, destravar dúvidas, ajustar prompts.',
   10, 9,'medium','Suporte',3,'consultant',false),
  ('ai-sprint','Check-in no grupo: preparação da Reunião 2',
   'Levantar o que funcionou, o que travou e o próximo gargalo a atacar. Confirmar a data da Reunião 2.',
   18, 10,'medium','Suporte',3,'consultant',false),

  -- Fase 4: Reunião 2
  ('ai-sprint','Realizar Reunião 2: ajuste, escala e novos casos de uso',
   '1h, tela compartilhada. Revisar o que foi implementado, corrigir o que não pegou, montar os próximos casos de uso e padronizar para o time.',
   21, 11,'urgent','Reunião 2',4,'consultant',false),
  ('ai-sprint','Enviar resumo e plano de 30 dias no grupo',
   'Casos de uso ativos, biblioteca de prompts, rotina de uso pelo time e próximos passos sem o Fabrício.',
   22, 12,'high','Reunião 2',4,'consultant',false),

  -- Fase 5: Encerramento
  ('ai-sprint','Registrar ganhos do sprint (horas economizadas e processos com IA)',
   'Antes x depois por caso de uso. Base para depoimento e case.',
   30, 13,'medium','Encerramento',5,'consultant',true),
  ('ai-sprint','Coletar NPS e depoimento',
   null,
   32, 14,'medium','Encerramento',5,'cs',true),
  ('ai-sprint','Apresentar continuidade (Diretor Comercial / UNV Board)',
   'Cliente com IA rodando é o momento de estruturar a operação comercial. Agendar conversa de continuidade.',
   33, 15,'high','Encerramento',5,'consultant',true),
  ('ai-sprint','Encerrar suporte no grupo de WhatsApp',
   'Mensagem de encerramento do sprint com o resumo dos ganhos. Suporte termina 15 dias após a Reunião 2.',
   36, 16,'medium','Encerramento',5,'consultant',true)
) as v(product_id, title, description, days, sort_order, priority, phase, phase_order, role, is_internal)
where not exists (
  select 1 from public.onboarding_task_templates t
  where t.product_id = v.product_id and t.title = v.title
);
