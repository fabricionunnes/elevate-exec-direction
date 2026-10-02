-- UNV AI Advisor (pedido do Fabrício, 02/10/2026).
-- Programa anual (R$ 36.000/ano, 12x no cartão): 2 reuniões individuais de 1h por mês com o
-- Fabrício (quinzenais) pra implementar IA (Claude, ChatGPT e afins) em gestão, comercial e
-- marketing. O cliente executa com a tela compartilhada, o Fabrício conduz. Entre as reuniões,
-- suporte no grupo de WhatsApp.
-- Serviço no catálogo (onboarding_services) + templates de tarefas por fase. O ciclo quinzenal
-- usa a recorrência nativa 'biweekly' (create_next_recurring_task cria a próxima ao concluir).
-- As tarefas globais (Jornada UNV, incluindo Contato mensal e Revisão 90 dias) continuam vindo
-- do trigger seed_global_project_tasks.
-- Idempotente: roda de novo sem duplicar serviço nem template.

insert into public.onboarding_services (name, slug, description, list_price, recurrence, is_active)
select
  'UNV AI Advisor',
  'ai-advisor',
  'Programa anual de IA aplicada com o Fabrício: 2 reuniões individuais de 1h por mês (quinzenais) + suporte no WhatsApp',
  36000,
  'anual',
  true
where not exists (
  select 1 from public.onboarding_services where slug = 'ai-advisor' and tenant_id is null
);

insert into public.onboarding_task_templates
  (product_id, title, description, default_days_offset, sort_order, priority, phase, phase_order, responsible_role, recurrence, is_internal)
select v.product_id, v.title, v.description, v.days, v.sort_order, v.priority, v.phase, v.phase_order, v.role, v.recurrence, v.is_internal
from (values
  -- Fase 1: Preparação (antes da primeira reunião)
  ('ai-advisor','Enviar diagnóstico de IA ao cliente',
   'Formulário curto: rotinas que mais tomam tempo em gestão, comercial e marketing; ferramentas que já usa; quem do time vai participar.',
   1, 1,'high','Preparação',1,'consultant',null,false),
  ('ai-advisor','Configurar grupo de suporte AI Advisor no WhatsApp',
   'Fixar mensagem com regras: horário de atendimento, como mandar dúvida (print + o que tentou), dia e horário fixo das reuniões quinzenais.',
   1, 2,'high','Preparação',1,'consultant',null,true),
  ('ai-advisor','Definir agenda fixa das reuniões quinzenais',
   'Dia e horário fixos a cada 15 dias, 1h, com link de videochamada e compartilhamento de tela. Lançar a recorrência na agenda do Fabrício e do cliente.',
   2, 3,'high','Preparação',1,'consultant',null,false),
  ('ai-advisor','Cliente criar contas nas ferramentas de IA',
   'Claude e/ou ChatGPT (plano pago recomendado) e acessos às ferramentas que serão integradas (CRM, planilhas, e-mail). Chegar na primeira reunião com tudo logado.',
   5, 4,'high','Preparação',1,'client',null,false),
  ('ai-advisor','Montar mapa de IA e backlog de casos de uso do ano',
   'A partir do diagnóstico, listar os casos de uso por área (gestão, comercial, marketing) e priorizar pelo filtro: horas economizadas, previsibilidade, margem.',
   6, 5,'high','Preparação',1,'consultant',null,true),

  -- Fase 2: Ciclo quinzenal (recorrente o ano todo)
  ('ai-advisor','Reunião quinzenal de IA (1h, individual)',
   'Tela compartilhada. Revisar o que foi aplicado desde a última reunião, destravar o que não pegou e implementar ao vivo o próximo caso de uso do backlog. O cliente clica, o Fabrício conduz.',
   7, 6,'urgent','Ciclo quinzenal',2,'consultant','biweekly',false),
  ('ai-advisor','Enviar resumo e plano de ação da reunião no grupo',
   'O que foi implementado, prompts usados e tarefas do cliente até a próxima reunião.',
   8, 7,'high','Ciclo quinzenal',2,'consultant','biweekly',false),
  ('ai-advisor','Check-in no grupo entre reuniões',
   'Perguntar o que já está rodando, destravar dúvidas, ajustar prompts e confirmar a próxima reunião.',
   12, 8,'medium','Ciclo quinzenal',2,'consultant','biweekly',false),

  -- Fase 3: Acompanhamento
  ('ai-advisor','Atualizar biblioteca de prompts do cliente',
   'Consolidar os prompts e fluxos que funcionaram no mês num documento único que o time usa.',
   30, 9,'medium','Acompanhamento',3,'consultant','monthly',true),
  ('ai-advisor','Revisão trimestral de ganhos com IA',
   'Horas economizadas e processos rodando com IA por área, antes x depois. Repriorizar o backlog do próximo trimestre. Apresentar ao cliente na reunião quinzenal.',
   90, 10,'high','Acompanhamento',3,'consultant','quarterly',false),
  ('ai-advisor','Coletar depoimento e case',
   'Com os números da primeira revisão trimestral em mãos.',
   120, 11,'medium','Acompanhamento',3,'cs',null,true),

  -- Fase 4: Renovação
  ('ai-advisor','Preparar balanço anual do AI Advisor',
   'Todos os casos de uso implementados, horas economizadas no ano e próximos passos.',
   320, 12,'high','Renovação',4,'consultant',null,true),
  ('ai-advisor','Conversa de renovação',
   'Apresentar o balanço anual e a proposta de renovação (ou continuidade com Diretor Comercial / UNV Board).',
   335, 13,'urgent','Renovação',4,'consultant',null,true)
) as v(product_id, title, description, days, sort_order, priority, phase, phase_order, role, recurrence, is_internal)
where not exists (
  select 1 from public.onboarding_task_templates t
  where t.product_id = v.product_id and t.title = v.title
);
