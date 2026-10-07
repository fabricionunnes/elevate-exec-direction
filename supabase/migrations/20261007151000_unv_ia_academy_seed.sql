-- =====================================================================
-- UNV IA ACADEMY — conteúdo inicial
-- 7 trilhas (uma por fase do Método CRESCER) com aulas, roteiro (content_md)
-- e entregável por aula, mais a biblioteca inicial do Laboratório de Agentes.
--
-- Vídeos entram depois pelo admin (video_url). As aulas nascem ativas com
-- roteiro e entregável pra que a trilha já sirva de guia de gravação e,
-- publicada, de material do aluno.
-- Idempotente: ON CONFLICT (id) DO NOTHING.
-- =====================================================================

-- ---------------------------------------------------------------------
-- TRILHAS
-- ---------------------------------------------------------------------
INSERT INTO public.academy_tracks
  (id, name, description, category, level, sort_order, is_active, require_sequential_lessons, require_quiz_to_advance, min_quiz_score, program, is_free_preview, crescer_phase, prerequisite_track_id)
VALUES
  ('7a000000-0000-4000-8000-000000000000', 'Trilha 0 · IA sem mistério para o dono da empresa',
   'A base. O que a IA faz de verdade numa PME, onde ela gera dinheiro, como escrever um prompt que funciona e o que não automatizar. Trilha aberta: assista antes de assinar.',
   'gestao', 1, 0, true, true, false, 70, 'ia_academy', true, NULL, NULL),

  ('7a000000-0000-4000-8000-000000000001', 'Trilha 1 · Cenário: diagnóstico da empresa com IA',
   'Fase C do CRESCER. Mapear processos, achar o gargalo e ler os dados do CRM e da planilha com IA antes de automatizar qualquer coisa.',
   'gestao', 1, 1, true, true, false, 70, 'ia_academy', false, 'cenario', NULL),

  ('7a000000-0000-4000-8000-000000000002', 'Trilha 2 · Estrutura: processo comercial documentado com IA',
   'Fases R e E do CRESCER. Resultado ideal em número e a estrutura escrita: playbook, scripts, descrição de cargo, onboarding de vendedor e rituais de gestão, tudo gerado e revisado com IA.',
   'vendas', 2, 2, true, true, false, 70, 'ia_academy', false, 'estrutura', NULL),

  ('7a000000-0000-4000-8000-000000000003', 'Trilha 3 · Captação: agentes que trazem lead todo dia',
   'Fase S do CRESCER (Sistema de Captação). Agente SDR no WhatsApp com N8N, prospecção com IA, conteúdo e anúncios gerados com IA.',
   'vendas', 2, 3, true, true, false, 70, 'ia_academy', false, 'captacao', NULL),

  ('7a000000-0000-4000-8000-000000000004', 'Trilha 4 · Conversão: fechar mais com os leads que já entram',
   'Fase C do CRESCER (Conversão). Agente de qualificação, follow-up automático, análise de gravação de call contra o script e proposta gerada com IA.',
   'vendas', 3, 4, true, true, false, 70, 'ia_academy', false, 'conversao', NULL),

  ('7a000000-0000-4000-8000-000000000005', 'Trilha 5 · Escala: gestão por número com agentes',
   'Fase E do CRESCER (Escala). Dashboard alimentado por IA, agente gestor que cobra cadência no WhatsApp, financeiro e RH com IA.',
   'gestao', 3, 5, true, true, false, 70, 'ia_academy', false, 'escala', NULL),

  ('7a000000-0000-4000-8000-000000000006', 'Trilha 6 · Revisão: auditoria, custo e governança de IA',
   'Fase R do CRESCER (Revisão). Auditoria mensal de processos, custo de IA, LGPD e quando trocar de ferramenta.',
   'gestao', 4, 6, true, true, false, 70, 'ia_academy', false, 'revisao', NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- AULAS
-- Padrão de roteiro em toda aula (12 a 20 min):
-- 1 Gancho (30s)  2 Promessa (30s)  3 Contexto no CRESCER (2 min)
-- 4 Demonstração tela aberta (8 a 12 min)  5 Erros comuns (2 min)
-- 6 Entregável (1 min)  7 Ponte pra próxima aula
-- ---------------------------------------------------------------------

-- ===== TRILHA 0 =====
INSERT INTO public.academy_lessons
  (id, track_id, title, description, estimated_duration_minutes, sort_order, is_active, points_on_complete, lesson_kind, content_md, deliverable_prompt, deliverable_points)
VALUES
('7a000000-0000-4000-8000-000000000100', '7a000000-0000-4000-8000-000000000000',
 'Onde a IA ganha dinheiro na sua empresa',
 'As 5 tarefas da sua operação que IA já faz hoje, e as 3 que você não deve automatizar.',
 15, 1, true, 10, 'video',
$md$## Gancho
Você está pagando salário pra alguém copiar e colar. Em toda empresa que a UNV entra, pelo menos 20% da semana do time comercial é tarefa repetitiva: responder a mesma pergunta no WhatsApp, lançar lead no CRM, montar proposta do zero.

## Promessa
Ao final desta aula você vai ter a lista das 5 tarefas da sua empresa que IA faz hoje, em ordem de retorno.

## Contexto
Esta trilha é o pré-requisito de tudo. Sem saber onde a IA entra, você compra ferramenta e não muda resultado. No Método CRESCER, isso é o começo do Cenário.

## Demonstração (tela aberta)
1. Abra uma rotina comum: o atendimento de um lead no WhatsApp.
2. Mostre o antes: vendedor demora 4 horas, responde sem qualificar, não registra nada.
3. Mostre o depois: agente responde em 30 segundos, faz as 4 perguntas de qualificação e já grava no CRM.
4. Faça a conta na tela: leads por mês × % que esfria por demora × ticket médio.
5. Apresente o mapa das 5 frentes onde IA gera dinheiro em PME: atendimento, qualificação, follow-up, conteúdo, gestão por número.

## O que não automatizar
Fechamento de venda complexa, conversa de cancelamento, feedback difícil pro time. Onde a relação é o produto, IA prepara, humano executa.

## Erros comuns
- Começar pela ferramenta mais famosa em vez do gargalo mais caro.
- Automatizar um processo que não existe. Improviso automatizado continua improviso.
- Querer substituir o vendedor em vez de tirar o peso morto da semana dele.

## Entregável
Preencha o template "Mapa das 5 tarefas" e poste o link. É o que o Fabrício vai olhar na sua sessão individual.$md$,
 'Liste as 5 tarefas repetitivas da sua operação comercial que mais consomem tempo hoje, com uma estimativa de horas por semana em cada uma. Cole o link do documento ou um print.',
 30),

('7a000000-0000-4000-8000-000000000101', '7a000000-0000-4000-8000-000000000000',
 'ChatGPT e Claude na prática: a conta certa e o jeito certo',
 'Qual conta assinar, como organizar projetos e a diferença entre conversar e dar instrução.',
 14, 2, true, 10, 'video',
$md$## Gancho
A maioria dos empresários usa IA como se fosse Google. Pergunta solta, resposta genérica, conclui que não serve.

## Promessa
Sair desta aula com a conta configurada e um projeto da sua empresa criado, com contexto salvo.

## Demonstração
1. Conta: plano pago de ChatGPT ou Claude. Mostre o preço e por que a versão gratuita não serve pra operação.
2. Crie um projeto chamado "Comercial [sua empresa]".
3. Cole as instruções do projeto: quem é a empresa, o que vende, pra quem, ticket, tom de voz. Use o template "Contexto da empresa" do Laboratório.
4. Faça a mesma pergunta fora e dentro do projeto. Mostre a diferença.
5. Regra de ouro: toda tarefa recorrente vira projeto com contexto salvo.

## Erros comuns
- Uma conversa gigante pra tudo.
- Não dizer quem é o público.
- Pedir "um texto" sem dizer canal, tamanho e objetivo.

## Entregável
Print do projeto criado com as instruções preenchidas.$md$,
 'Crie o projeto da sua empresa no ChatGPT ou Claude com o template "Contexto da empresa" preenchido e envie um print.',
 30),

('7a000000-0000-4000-8000-000000000102', '7a000000-0000-4000-8000-000000000000',
 'O prompt que funciona: papel, contexto, tarefa, formato, critério',
 'A estrutura de 5 blocos que a UNV usa em todo agente. Da pergunta solta à instrução que gera resultado.',
 16, 3, true, 10, 'video',
$md$## Gancho
A diferença entre "escreve um script de vendas" e um script que o seu time usa amanhã está em 5 linhas de instrução.

## Promessa
Você vai sair com o seu primeiro prompt estruturado, salvo e testado.

## Demonstração
Construa ao vivo, bloco a bloco:
1. **Papel**: "Você é um diretor comercial com 20 anos de experiência em PMEs de serviço."
2. **Contexto**: cole o contexto da empresa (aula anterior).
3. **Tarefa**: "Escreva o script de abordagem para lead que chegou pelo Instagram."
4. **Formato**: "Em 6 etapas, com a frase exata de cada etapa e a resposta pronta para as 3 objeções mais comuns."
5. **Critério**: "Tom direto, sem jargão, no máximo 2 frases por etapa. Não prometa resultado."
Rode. Compare com a versão sem estrutura. Ajuste o critério e rode de novo.

## Erros comuns
- Pular o critério. Sem critério a IA decide o padrão por você.
- Não dar exemplo do que é bom.
- Aceitar a primeira resposta. A segunda rodada é onde o resultado aparece.

## Entregável
Seu prompt de 5 blocos salvo no projeto e um print da resposta.$md$,
 'Escreva um prompt de 5 blocos (papel, contexto, tarefa, formato, critério) para uma tarefa real do seu comercial e envie o prompt mais um print da resposta gerada.',
 30),

('7a000000-0000-4000-8000-000000000103', '7a000000-0000-4000-8000-000000000000',
 'Agente, automação e chatbot: a diferença que define o que você compra',
 'O vocabulário mínimo pra não ser enganado por fornecedor e pra escolher a ferramenta certa pra cada tarefa.',
 12, 4, true, 10, 'video',
$md$## Gancho
Chatbot de menu não é agente. Agente sem processo é chatbot caro.

## Promessa
Ao final, você vai saber classificar qualquer proposta de fornecedor em 3 categorias e decidir em 1 minuto se faz sentido.

## Demonstração
1. **Automação**: regra fixa. Se lead entra, manda mensagem X. Ferramenta: N8N, Make, Zapier.
2. **Chatbot**: menu de opções. Serve pra triagem simples.
3. **Agente**: tem objetivo, contexto, ferramentas e decide o próximo passo. Exemplo real: o agente SDR da Trilha 3.
4. Mostre a stack da UNV: N8N + WhatsApp API + modelo de IA + CRM. Cada peça faz uma coisa.
5. Mostre 2 propostas reais de mercado e classifique.

## Erros comuns
- Comprar "IA" sem saber qual das 3 coisas está comprando.
- Pagar mensalidade por agente e não ter processo pra ele seguir.
- Achar que precisa programar. Não precisa. Precisa de processo claro.

## Entregável
Nenhum entregável obrigatório nesta aula. Responda o quiz da trilha.$md$,
 NULL, 0),

('7a000000-0000-4000-8000-000000000104', '7a000000-0000-4000-8000-000000000000',
 'Seu plano de 90 dias com IA (e como usar a sessão individual)',
 'Como escolher a primeira implementação, o que levar pra sessão de planejamento com o Fabrício e como funciona o hotseat mensal.',
 10, 5, true, 10, 'video',
$md$## Gancho
Quem tenta implementar tudo em 30 dias não implementa nada. Quem escolhe uma coisa e roda, muda o mês seguinte.

## Promessa
Sair com a primeira implementação escolhida e preparado pra sessão individual.

## Demonstração
1. Pegue o Mapa das 5 tarefas (aula 1).
2. Critério de escolha: maior retorno em dinheiro × menor dependência de terceiros. Normalmente é atendimento ou follow-up.
3. Monte o plano de 90 dias: mês 1 uma implementação, mês 2 medir e ajustar, mês 3 segunda implementação.
4. O que levar pra sessão individual: mapa das 5 tarefas, números do funil (leads, conversas, propostas, vendas), ferramentas que já usa.
5. Hotseat mensal: como se inscrever, como enviar o caso, o que acontece ao vivo.

## Entregável
Peça a sua sessão individual em Encontros ao Vivo e anexe o mapa das 5 tarefas.$md$,
 'Escolha a primeira implementação de IA da sua empresa e justifique em 3 linhas: retorno esperado, quem executa e em quanto tempo mede. Depois solicite a sessão individual na aba Encontros ao Vivo.',
 30)
ON CONFLICT (id) DO NOTHING;

-- ===== TRILHA 1 · CENÁRIO =====
INSERT INTO public.academy_lessons
  (id, track_id, title, description, estimated_duration_minutes, sort_order, is_active, points_on_complete, lesson_kind, content_md, deliverable_prompt, deliverable_points)
VALUES
('7a000000-0000-4000-8000-000000000110', '7a000000-0000-4000-8000-000000000001',
 'Mapear o processo comercial em 30 minutos com IA',
 'Da conversa gravada ao fluxograma: a IA desenha o processo que roda hoje na sua empresa, com os buracos.',
 18, 1, true, 10, 'video',
$md$## Gancho
Ninguém melhora o que não enxerga. Na maioria das PMEs o processo comercial mora na cabeça do dono.

## Promessa
Processo atual desenhado, etapa por etapa, com os pontos onde o lead some.

## Demonstração
1. Grave 10 minutos de áudio descrevendo como um lead vira cliente hoje. Sem filtro.
2. Transcreva (o próprio ChatGPT ou Claude aceita áudio, ou use o transcritor do Laboratório).
3. Prompt "Mapeador de processo" do Laboratório: pede etapas, dono, ferramenta, tempo e onde não há critério de passagem.
4. Peça a IA pra marcar as 3 etapas sem dono ou sem critério.
5. Gere o fluxograma em texto (Mermaid) e cole no Nexus ou no Miro.

## Erros comuns
- Descrever o processo ideal em vez do real.
- Não incluir o que acontece quando o lead some.

## Entregável
Fluxograma do processo atual com os 3 buracos marcados.$md$,
 'Envie o fluxograma do seu processo comercial atual (imagem ou link) com as 3 etapas sem dono ou sem critério marcadas.',
 30),

('7a000000-0000-4000-8000-000000000111', '7a000000-0000-4000-8000-000000000001',
 'Raio-X Comercial: as 7 dimensões e o escore 0 a 70',
 'O diagnóstico da UNV aplicado à sua empresa, com a IA conduzindo as perguntas e calculando o escore.',
 20, 2, true, 10, 'video',
$md$## Gancho
Toda empresa que a UNV atende passa pelo Raio-X antes de qualquer plano. Nota baixa não é problema. Não saber a nota é.

## Promessa
Escore do Raio-X da sua empresa, por dimensão, e a dimensão que vai primeiro.

## Demonstração
1. As 7 dimensões: público, funil, abordagem, objeção, follow-up, rotina, meta. 10 pontos cada.
2. Rode o prompt "Raio-X Comercial" do Laboratório. A IA faz as perguntas uma por vez.
3. Responda com honestidade. Mostre um exemplo real com nota 31.
4. Leia o laudo: dimensão mais baixa com maior impacto em receita vai primeiro.
5. Cruze com o fluxograma da aula anterior.

## Erros comuns
- Responder o que gostaria que fosse.
- Tentar atacar as 7 dimensões ao mesmo tempo.

## Entregável
Laudo do Raio-X com escore e a dimensão prioritária.$md$,
 'Envie o laudo do seu Raio-X Comercial (escore total, nota por dimensão e a dimensão prioritária).',
 30),

('7a000000-0000-4000-8000-000000000112', '7a000000-0000-4000-8000-000000000001',
 'Ler o CRM e a planilha com IA: onde a venda morre',
 'Exportar os dados, subir pra IA e sair com as taxas de passagem do funil e o gargalo com número.',
 20, 3, true, 10, 'video',
$md$## Gancho
Você tem os dados. Só nunca ninguém olhou pra eles do jeito certo.

## Promessa
Taxa de passagem entre cada etapa do funil e o gargalo com número, em 20 minutos.

## Demonstração
1. Exporte os negócios dos últimos 90 dias do CRM (ou a planilha de leads). CSV.
2. Suba pra IA com o prompt "Analista de funil" do Laboratório.
3. Peça: leads por origem, taxa de passagem por etapa, tempo médio em cada etapa, motivos de perda.
4. Mostre o padrão mais comum: 40% dos leads param na etapa "proposta enviada" sem follow-up.
5. Transforme o achado em frase de gargalo: "Perdemos X leads por mês na etapa Y porque Z."

## Erros comuns
- Dados sem data de entrada e saída de etapa. Comece a registrar hoje.
- Confiar em motivo de perda "sem interesse". Quase sempre é follow-up.

## Entregável
Tabela de taxas de passagem e a frase do gargalo.$md$,
 'Envie a tabela de taxas de passagem do seu funil (últimos 90 dias) e a frase do gargalo no formato: "Perdemos X leads por mês na etapa Y porque Z".',
 30),

('7a000000-0000-4000-8000-000000000113', '7a000000-0000-4000-8000-000000000001',
 'ICP com IA: pra quem vender e pra quem parar de vender',
 'Cruzar os melhores clientes com IA e sair com o perfil de cliente ideal e a lista de quem não entra mais no funil.',
 15, 4, true, 10, 'video',
$md$## Gancho
Metade do esforço do seu time vai pra lead que nunca vai comprar. O ICP é o filtro.

## Promessa
Perfil de cliente ideal escrito e 5 critérios de desqualificação.

## Demonstração
1. Liste seus 10 melhores clientes: ticket, tempo de casa, facilidade de venda, indicação.
2. Liste os 5 piores.
3. Prompt "Construtor de ICP": padrões em comum, sinais de compra, sinais de alerta.
4. Escreva o ICP em 1 parágrafo e 5 critérios de desqualificação.
5. Isso alimenta o agente SDR da Trilha 3.

## Entregável
ICP em 1 parágrafo mais os 5 critérios.$md$,
 'Envie o ICP da sua empresa (1 parágrafo) e os 5 critérios de desqualificação.',
 30),

('7a000000-0000-4000-8000-000000000114', '7a000000-0000-4000-8000-000000000001',
 'Implementação ao vivo: o diagnóstico de um aluno do zero ao plano',
 'Gravação do encontro de implementação: Fabrício conduz o diagnóstico completo de uma empresa real da turma.',
 60, 5, true, 15, 'live_recording',
$md$Gravação do encontro ao vivo de implementação da Trilha 1. Caso real de aluno: fluxograma, Raio-X, leitura do funil e ICP, com o plano de 90 dias montado ao final.

Assista com o seu material do lado e compare.$md$,
 NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- ===== TRILHA 2 · ESTRUTURA =====
INSERT INTO public.academy_lessons
  (id, track_id, title, description, estimated_duration_minutes, sort_order, is_active, points_on_complete, lesson_kind, content_md, deliverable_prompt, deliverable_points)
VALUES
('7a000000-0000-4000-8000-000000000120', '7a000000-0000-4000-8000-000000000002',
 'Resultado ideal em número: meta, funil reverso e capacidade',
 'A IA monta o funil reverso da sua meta: quantos leads, conversas e propostas por vendedor por semana.',
 15, 1, true, 10, 'video',
$md$## Gancho
Meta sem funil reverso é desejo. Com funil reverso vira rotina diária.

## Promessa
Meta do trimestre quebrada em atividade por vendedor por dia.

## Demonstração
1. Insumos: meta de faturamento, ticket médio, taxas de passagem (Trilha 1).
2. Prompt "Funil reverso": a IA calcula vendas, propostas, conversas e leads necessários.
3. Divida por vendedor e por dia útil.
4. Cheque capacidade: cabe na agenda? Se não cabe, a resposta é processo ou contratação, não pressão.

## Entregável
Funil reverso da meta com atividade diária por vendedor.$md$,
 'Envie o funil reverso da sua meta do trimestre: vendas, propostas, conversas e leads necessários por vendedor por dia.',
 30),

('7a000000-0000-4000-8000-000000000121', '7a000000-0000-4000-8000-000000000002',
 'Playbook de vendas gerado e revisado com IA',
 'As 6 etapas do processo UNV (prospecção, qualificação, diagnóstico, proposta, fechamento, handoff) escritas pra sua empresa, com dono, critério de saída e métrica.',
 20, 2, true, 10, 'video',
$md$## Gancho
Playbook não é PDF bonito. É a regra de que ninguém avança etapa sem cumprir o critério.

## Promessa
Playbook de 6 etapas pronto pra rodar na segunda-feira.

## Demonstração
1. Prompt "Gerador de playbook UNV" com ICP, funil reverso e processo atual.
2. Para cada etapa: objetivo, dono, ações, critério de saída, métrica, ferramenta.
3. Revise com a IA fazendo o papel de vendedor cético: "onde isso trava na prática?"
4. Reduza. Playbook de 40 páginas ninguém lê. 6 páginas, uma por etapa.
5. Publique no Nexus (módulo Treinamentos ou Processos).

## Erros comuns
- Etapa sem critério de saída.
- Copiar playbook de outra empresa.

## Entregável
Playbook de 6 etapas publicado.$md$,
 'Envie o link do seu playbook de 6 etapas (cada etapa com dono, critério de saída e métrica).',
 40),

('7a000000-0000-4000-8000-000000000122', '7a000000-0000-4000-8000-000000000002',
 'Scripts e contorno de objeção com IA',
 'Script de abordagem por canal e as respostas prontas para as 10 objeções da sua empresa, geradas a partir de conversas reais.',
 18, 3, true, 10, 'video',
$md$## Gancho
"Tá caro", "vou pensar", "vou ver com meu sócio". Seu time ouve isso todo dia e improvisa a resposta todo dia.

## Promessa
Script por canal e banco de 10 objeções com resposta pronta.

## Demonstração
1. Exporte 20 conversas reais de WhatsApp (anonimizadas).
2. Prompt "Minerador de objeções": a IA lista as objeções reais e a frequência.
3. Para cada uma, 2 respostas: uma consultiva, uma direta.
4. Script de abordagem por canal (WhatsApp, Instagram, indicação) com no máximo 2 frases por etapa.
5. Teste em role-play com a IA fazendo o cliente.

## Entregável
Banco de objeções e script por canal.$md$,
 'Envie o banco das 10 objeções mais frequentes da sua empresa com resposta pronta, e o script de abordagem de pelo menos 1 canal.',
 30),

('7a000000-0000-4000-8000-000000000123', '7a000000-0000-4000-8000-000000000002',
 'Descrição de cargo, onboarding de vendedor e trilha de 30 dias',
 'Com IA: o que o vendedor faz, como é medido, e o plano dos primeiros 30 dias dentro do Nexus.',
 15, 4, true, 10, 'video',
$md$## Gancho
Vendedor novo leva 90 dias pra render porque ninguém escreveu o que ele precisa saber nos primeiros 30.

## Promessa
Descrição de cargo e trilha de onboarding de 30 dias prontas.

## Demonstração
1. Prompt "Descrição de cargo comercial": responsabilidades, métricas, rotina semanal, critérios de promoção.
2. Prompt "Onboarding 30 dias": semana a semana, com entregável e checkpoint.
3. Suba no UNV Profile (RH) do Nexus como treinamentos atribuídos.

## Entregável
Descrição de cargo e trilha de 30 dias.$md$,
 'Envie a descrição de cargo do vendedor e a trilha de onboarding de 30 dias (semana a semana).',
 30),

('7a000000-0000-4000-8000-000000000124', '7a000000-0000-4000-8000-000000000002',
 'Rituais de gestão: daily, semanal e mensal com pauta gerada por IA',
 'Os 3 rituais da UNV com a IA preparando a pauta a partir dos números do CRM.',
 14, 5, true, 10, 'video',
$md$## Gancho
Reunião sem número na tela é bate-papo. Reunião com número é gestão.

## Promessa
Os 3 rituais agendados, com pauta automática.

## Demonstração
1. Daily de 15 min: cadência de atividades. Semanal: funil e deals parados. Mensal: resultado e plano.
2. Prompt "Pauta de reunião comercial": a IA lê o export do CRM e devolve a pauta com os 3 deals que precisam de decisão.
3. Regra: todo deal parado sai da reunião com decisão.
4. Agende os 3 rituais no calendário do time.

## Entregável
Print dos rituais agendados e uma pauta gerada.$md$,
 'Envie print dos 3 rituais agendados (daily, semanal, mensal) e uma pauta semanal gerada pela IA a partir dos seus dados.',
 30)
ON CONFLICT (id) DO NOTHING;

-- ===== TRILHA 3 · CAPTAÇÃO =====
INSERT INTO public.academy_lessons
  (id, track_id, title, description, estimated_duration_minutes, sort_order, is_active, points_on_complete, lesson_kind, content_md, deliverable_prompt, deliverable_points)
VALUES
('7a000000-0000-4000-8000-000000000130', '7a000000-0000-4000-8000-000000000003',
 'A arquitetura do sistema de captação com IA',
 'Como as peças se encaixam: canal de entrada, agente SDR, CRM, alerta pro closer. O desenho antes de construir.',
 12, 1, true, 10, 'video',
$md$## Gancho
Lead sem resposta em 5 minutos perde 80% da chance de fechar. E ninguém responde em 5 minutos de madrugada.

## Promessa
O desenho do seu sistema de captação, com cada ferramenta no lugar.

## Demonstração
1. Entradas: Instagram, anúncio, site, indicação, WhatsApp direto.
2. Centro: N8N recebendo tudo.
3. Agente SDR: qualifica com as 4 perguntas da UNV.
4. CRM: grava lead, origem, respostas.
5. Alerta: closer recebe no WhatsApp o lead qualificado com resumo.
6. Desenhe o seu com o template do Laboratório.

## Entregável
Desenho da arquitetura da sua captação.$md$,
 'Envie o desenho da arquitetura do seu sistema de captação (canais de entrada, automação, agente, CRM, alerta).',
 30),

('7a000000-0000-4000-8000-000000000131', '7a000000-0000-4000-8000-000000000003',
 'WhatsApp API e N8N: conectar sem programar',
 'Criar a conta, conectar o número e montar o primeiro fluxo que recebe mensagem e responde.',
 20, 2, true, 10, 'video',
$md$## Gancho
Isso parece técnico. São 6 cliques e um copiar-colar.

## Promessa
Número conectado e primeiro fluxo respondendo.

## Demonstração
1. Conta N8N (cloud) e conexão com a API do WhatsApp (oficial ou via Evolution).
2. Importe o fluxo "Recepção WhatsApp" do Laboratório.
3. Configure o nó de entrada com o seu número.
4. Teste: mande "oi" e veja o fluxo rodar.
5. Entenda os 3 nós: gatilho, decisão, envio.

## Erros comuns
- Usar número pessoal.
- Não testar com telefone de fora da empresa.

## Entregável
Print do fluxo rodando com uma mensagem recebida.$md$,
 'Envie um print do seu fluxo no N8N executado com uma mensagem real recebida pelo WhatsApp.',
 30),

('7a000000-0000-4000-8000-000000000132', '7a000000-0000-4000-8000-000000000003',
 'Agente SDR no WhatsApp em 40 minutos',
 'O agente que qualifica lead 24 horas por dia com as 4 perguntas da UNV, grava no CRM e passa pro closer.',
 25, 3, true, 15, 'video',
$md$## Gancho
Lead sem resposta em 5 minutos cai 80% na chance de fechar. Seu agente responde em 30 segundos, de madrugada, no domingo.

## Promessa
Agente qualificando lead de verdade ao final da aula.

## Demonstração
1. Importe o fluxo "Agente SDR UNV" do Laboratório no N8N.
2. Cole o prompt do agente. Estrutura: papel, contexto da empresa (Trilha 0), ICP (Trilha 1), as 4 perguntas de qualificação (quem é, o que precisa, quando, quanto), critério de passagem, tom.
3. Regra do agente: qualificar, não vender. No máximo 8 mensagens. Se o lead pedir humano, passa.
4. Conecte ao CRM: cria o lead com as respostas.
5. Alerta pro closer: resumo de 3 linhas no WhatsApp.
6. Teste com 3 conversas: lead quente, lead frio, lead confuso.

## Erros comuns
- Agente que tenta vender em vez de qualificar.
- Sem handoff humano claro.
- Sem limite de mensagens: vira conversa infinita.
- Prompt sem ICP: qualifica todo mundo.

## Entregável
Print de uma conversa real qualificada e o lead criado no CRM.$md$,
 'Envie o print de uma conversa real do seu agente SDR qualificando um lead e o print do lead criado no CRM com as respostas.',
 50),

('7a000000-0000-4000-8000-000000000133', '7a000000-0000-4000-8000-000000000003',
 'Prospecção ativa com IA: lista, pesquisa e primeira mensagem',
 'Montar lista dentro do ICP, pesquisar cada empresa com IA e escrever a primeira mensagem personalizada em escala.',
 18, 4, true, 10, 'video',
$md$## Gancho
Mensagem genérica em massa é spam. Mensagem personalizada uma a uma não escala. IA faz as duas coisas ao mesmo tempo.

## Promessa
Lista de 50 empresas dentro do ICP com primeira mensagem personalizada pronta.

## Demonstração
1. Fonte da lista: Google Maps, Instagram, LinkedIn, base própria. Critérios do ICP.
2. Prompt "Pesquisador de empresa": a IA resume o que a empresa faz, sinais de dor, gancho de abertura.
3. Prompt "Primeira mensagem": 3 linhas, gancho específico, pergunta aberta, sem pitch.
4. Monte a planilha: empresa, contato, gancho, mensagem, status.
5. Cadência: dia 1 mensagem, dia 3 follow-up, dia 7 último toque.

## Entregável
Planilha com 50 empresas e mensagens.$md$,
 'Envie a planilha com pelo menos 50 empresas dentro do ICP, gancho pesquisado e primeira mensagem personalizada.',
 30),

('7a000000-0000-4000-8000-000000000134', '7a000000-0000-4000-8000-000000000003',
 'Conteúdo que gera lead: 30 dias de posts em 1 hora com IA',
 'Do banco de dores do cliente ao calendário mensal de conteúdo, com roteiro de vídeo e legenda.',
 16, 5, true, 10, 'video',
$md$## Gancho
Conteúdo não é sobre postar todo dia. É sobre responder as perguntas que o seu cliente faz antes de comprar.

## Promessa
Calendário de 30 dias com roteiros prontos.

## Demonstração
1. Insumo: banco de objeções (Trilha 2) e perguntas frequentes do agente SDR.
2. Prompt "Calendário de conteúdo": 30 ideias em 4 pilares (dor, prova, método, bastidor).
3. Para cada ideia: roteiro de 60s e legenda com chamada pro WhatsApp.
4. Grave em lote: 10 vídeos em uma manhã.

## Entregável
Calendário de 30 dias com 5 roteiros prontos.$md$,
 'Envie o calendário de conteúdo de 30 dias e pelo menos 5 roteiros de vídeo prontos para gravar.',
 30),

('7a000000-0000-4000-8000-000000000135', '7a000000-0000-4000-8000-000000000003',
 'Anúncios com IA: criativo, copy e leitura de resultado',
 'Gerar variações de anúncio, montar a campanha de mensagem no WhatsApp e ler o relatório com IA.',
 16, 6, true, 10, 'video',
$md$## Gancho
Anúncio bom com atendimento ruim é dinheiro queimado. Agora que o agente atende, o anúncio paga.

## Promessa
Primeira campanha de mensagem no ar com 3 variações de criativo.

## Demonstração
1. Prompt "Copy de anúncio": 3 ângulos (dor, resultado, prova) a partir do ICP.
2. Criativo: imagem ou vídeo gerado ou gravado. Texto curto.
3. Campanha de mensagens pro WhatsApp, que cai no agente SDR.
4. Depois de 7 dias: exporte o relatório e peça pra IA ler custo por lead qualificado, não por clique.

## Entregável
Print da campanha e das 3 variações.$md$,
 'Envie print da sua campanha de anúncios ativa com as 3 variações de criativo e, se já houver, o custo por lead qualificado da primeira semana.',
 30),

('7a000000-0000-4000-8000-000000000136', '7a000000-0000-4000-8000-000000000003',
 'Implementação ao vivo: agente SDR de um aluno construído na tela',
 'Gravação do encontro de implementação: do número conectado ao primeiro lead qualificado, com os erros reais do caminho.',
 60, 7, true, 15, 'live_recording',
$md$Gravação do encontro ao vivo de implementação da Trilha 3. Um aluno da turma constrói o agente SDR com o Fabrício, ao vivo, com as perguntas de quem está assistindo.$md$,
 NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- ===== TRILHA 4 · CONVERSÃO =====
INSERT INTO public.academy_lessons
  (id, track_id, title, description, estimated_duration_minutes, sort_order, is_active, points_on_complete, lesson_kind, content_md, deliverable_prompt, deliverable_points)
VALUES
('7a000000-0000-4000-8000-000000000140', '7a000000-0000-4000-8000-000000000004',
 'Follow-up automático que não parece automático',
 'Cadência de 5 toques por etapa do funil, escrita pela IA no tom da sua empresa, disparada pelo N8N.',
 18, 1, true, 10, 'video',
$md$## Gancho
40% dos leads morrem na etapa "proposta enviada" porque ninguém voltou. Não é falta de interesse. É falta de follow-up.

## Promessa
Cadência de 5 toques rodando pra toda proposta enviada.

## Demonstração
1. Prompt "Cadência de follow-up": 5 mensagens, cada uma com um motivo real pra voltar (não "passando pra saber").
2. Importe o fluxo "Follow-up por etapa" do Laboratório.
3. Gatilho: mudança de etapa no CRM. Parada: resposta do lead.
4. Teste com um lead de teste.

## Erros comuns
- Mensagem sem motivo.
- Não parar quando o lead responde.

## Entregável
Print da cadência ativa e de um follow-up enviado.$md$,
 'Envie print da sua cadência de follow-up ativa no N8N e de pelo menos uma mensagem enviada a um lead real.',
 40),

('7a000000-0000-4000-8000-000000000141', '7a000000-0000-4000-8000-000000000004',
 'Transformar gravação de call em treino',
 'Toda call vira nota contra o script em 2 minutos, com as 3 correções pro vendedor.',
 18, 2, true, 10, 'video',
$md$## Gancho
Você não sabe o que seu vendedor fala quando você não está na sala. Agora vai saber, e sem ouvir 40 horas de gravação.

## Promessa
Toda call avaliada contra o playbook em 2 minutos.

## Demonstração
1. Grave a call (Meet, telefone, WhatsApp áudio).
2. Transcreva.
3. Prompt "Avaliador de call UNV": compara com as etapas do playbook, dá nota por etapa, aponta 3 correções e 1 acerto.
4. Devolutiva pro vendedor em formato fixo. Toda semana, 2 calls por vendedor.
5. Padrão de erro repetido vira pauta da reunião semanal.

## Entregável
Avaliação de uma call real do seu time.$md$,
 'Envie a avaliação de uma call real do seu time gerada pela IA (nota por etapa, 3 correções, 1 acerto).',
 30),

('7a000000-0000-4000-8000-000000000142', '7a000000-0000-4000-8000-000000000004',
 'Proposta comercial gerada com IA a partir do diagnóstico',
 'Da anotação da reunião à proposta personalizada em 10 minutos, no template da empresa.',
 15, 3, true, 10, 'video',
$md$## Gancho
Proposta que demora 3 dias pra sair chega quando o cliente já esfriou.

## Promessa
Proposta personalizada no mesmo dia da reunião.

## Demonstração
1. Insumo: anotação ou transcrição da reunião de diagnóstico.
2. Prompt "Gerador de proposta": contexto do cliente, dor em palavras dele, solução, investimento, próximos passos.
3. Template fixo da empresa (Docs ou Nexus).
4. Regra: proposta sai em até 24h.

## Entregável
Uma proposta gerada a partir de reunião real.$md$,
 'Envie uma proposta comercial gerada com IA a partir de uma reunião real (pode anonimizar o cliente).',
 30),

('7a000000-0000-4000-8000-000000000143', '7a000000-0000-4000-8000-000000000004',
 'Agente de reativação: a base parada vira caixa',
 'Agente que volta em leads perdidos e clientes antigos com oferta certa, sem incomodar.',
 16, 4, true, 10, 'video',
$md$## Gancho
Sua base de leads perdidos é o canal de captação mais barato que você tem. E está parado.

## Promessa
Campanha de reativação rodando pra base antiga.

## Demonstração
1. Exporte leads perdidos há mais de 90 dias e clientes inativos.
2. Segmente por motivo de perda com IA.
3. Prompt "Mensagem de reativação" por segmento: contexto, novidade, pergunta.
4. Dispare em lotes pequenos via N8N. Quem responde cai no agente SDR.

## Entregável
Print da campanha e das respostas da primeira semana.$md$,
 'Envie print da campanha de reativação (segmentos, mensagens) e o número de respostas da primeira semana.',
 30),

('7a000000-0000-4000-8000-000000000144', '7a000000-0000-4000-8000-000000000004',
 'Implementação ao vivo: funil de conversão de um aluno revisado na tela',
 'Gravação do encontro de implementação: follow-up, avaliação de call e proposta montados num caso real.',
 60, 5, true, 15, 'live_recording',
$md$Gravação do encontro ao vivo de implementação da Trilha 4.$md$,
 NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- ===== TRILHA 5 · ESCALA =====
INSERT INTO public.academy_lessons
  (id, track_id, title, description, estimated_duration_minutes, sort_order, is_active, points_on_complete, lesson_kind, content_md, deliverable_prompt, deliverable_points)
VALUES
('7a000000-0000-4000-8000-000000000150', '7a000000-0000-4000-8000-000000000005',
 'Os 6 números do dono: ticket, conversão, CAC, LTV, churn, NPS',
 'O que medir, como calcular e como a IA transforma planilha em leitura semanal.',
 15, 1, true, 10, 'video',
$md$## Gancho
Dono que olha 30 indicadores não decide nada. Dono que olha 6, decide toda semana.

## Promessa
Os 6 números da sua empresa calculados e a leitura semanal automatizada.

## Demonstração
1. Defina a fonte de cada número (CRM, financeiro, pesquisa).
2. Prompt "Leitura semanal do dono": a IA recebe os 6 números e devolve o que mudou, por quê e a ação da semana.
3. Monte a rotina: toda segunda, 10 minutos.

## Entregável
Os 6 números do último mês e a leitura gerada.$md$,
 'Envie os 6 números da sua empresa no último mês (ticket, conversão, CAC, LTV, churn, NPS) e a leitura semanal gerada pela IA.',
 30),

('7a000000-0000-4000-8000-000000000151', '7a000000-0000-4000-8000-000000000005',
 'Dashboard no Looker Studio alimentado pelo CRM',
 'Conectar a fonte, montar o painel do funil e deixar a IA explicar o gráfico toda semana.',
 20, 2, true, 10, 'video',
$md$## Gancho
Gráfico sem leitura é decoração. Gráfico com leitura é decisão.

## Promessa
Painel do funil no ar com atualização automática.

## Demonstração
1. Fonte: export automático do CRM pra planilha (N8N) ou conector nativo.
2. Looker Studio: funil, taxa de passagem, por vendedor, por origem.
3. Prompt "Explica o painel": a IA lê o print e escreve 5 linhas pro time.

## Entregável
Link do painel.$md$,
 'Envie o link ou print do seu painel de funil no Looker Studio com atualização automática.',
 30),

('7a000000-0000-4000-8000-000000000152', '7a000000-0000-4000-8000-000000000005',
 'Agente gestor: a IA que cobra a cadência do time no WhatsApp',
 'Agente que todo dia pergunta as atividades, consolida e manda o resumo pro gestor. Sem planilha, sem cobrança manual.',
 20, 3, true, 15, 'video',
$md$## Gancho
A cadência morre quando depende do gestor cobrar. O agente não esquece, não desanima, não tem segunda-feira.

## Promessa
Agente gestor cobrando o time e consolidando o dia.

## Demonstração
1. Importe o fluxo "Agente gestor" do Laboratório.
2. Às 17h: pergunta a cada vendedor leads, conversas, propostas, vendas do dia.
3. Consolida e manda o resumo pro gestor com comparação contra o funil reverso.
4. Sexta: resumo da semana com quem está abaixo da cadência.
5. Mesmo mecanismo do agente do UNV Board.

## Entregável
Print de um resumo diário gerado.$md$,
 'Envie print de um resumo diário gerado pelo seu agente gestor a partir das respostas reais do time.',
 50),

('7a000000-0000-4000-8000-000000000153', '7a000000-0000-4000-8000-000000000005',
 'Financeiro com IA: do extrato à margem por produto',
 'Importar o extrato, categorizar com IA e descobrir qual produto dá lucro de verdade.',
 16, 4, true, 10, 'video',
$md$## Gancho
Faturar mais não é lucrar mais. Você sabe a margem de cada produto?

## Promessa
Margem por produto calculada e as 3 despesas que mais crescem identificadas.

## Demonstração
1. Exporte o extrato (banco ou Conta Azul).
2. Prompt "Categorizador financeiro": a IA classifica cada lançamento.
3. Cruze receita por produto com custo direto.
4. Leitura: onde a margem está vazando.

## Entregável
Tabela de margem por produto.$md$,
 'Envie a tabela de margem por produto do último mês gerada com apoio da IA.',
 30),

('7a000000-0000-4000-8000-000000000154', '7a000000-0000-4000-8000-000000000005',
 'RH com IA: contratar vendedor com triagem automática e DISC',
 'Vaga, triagem de currículo com IA, perfil comportamental e entrevista estruturada dentro do UNV Profile.',
 16, 5, true, 10, 'video',
$md$## Gancho
Contratação errada custa 6 meses de salário e 1 ano de resultado.

## Promessa
Processo seletivo de vendedor rodando com triagem automática.

## Demonstração
1. Prompt "Vaga comercial": descrição a partir do cargo (Trilha 2).
2. Triagem: a IA lê currículos e pontua contra os critérios.
3. DISC e teste prático no UNV Profile.
4. Roteiro de entrevista estruturada gerado.

## Entregável
Vaga publicada e critérios de triagem.$md$,
 'Envie a vaga publicada e os critérios de triagem automática que a IA vai usar.',
 30)
ON CONFLICT (id) DO NOTHING;

-- ===== TRILHA 6 · REVISÃO =====
INSERT INTO public.academy_lessons
  (id, track_id, title, description, estimated_duration_minutes, sort_order, is_active, points_on_complete, lesson_kind, content_md, deliverable_prompt, deliverable_points)
VALUES
('7a000000-0000-4000-8000-000000000160', '7a000000-0000-4000-8000-000000000006',
 'Auditoria mensal: o que a IA está fazendo, o que está errando',
 'Checklist de 30 minutos pra revisar cada agente e automação: volume, erros, conversas que deram errado.',
 15, 1, true, 10, 'video',
$md$## Gancho
Agente que ninguém revisa vira o vendedor ruim que você nunca demite.

## Promessa
Rotina de auditoria mensal de 30 minutos.

## Demonstração
1. Para cada agente: volume do mês, taxa de handoff, conversas com erro.
2. Prompt "Auditor de conversas": a IA lê uma amostra de 20 conversas e aponta onde o agente saiu do script.
3. Ajuste o prompt do agente. Versione.
4. Registre no checklist do Laboratório.

## Entregável
Auditoria do mês com ajustes feitos.$md$,
 'Envie a auditoria mensal dos seus agentes (volume, erros encontrados, ajustes feitos no prompt).',
 30),

('7a000000-0000-4000-8000-000000000161', '7a000000-0000-4000-8000-000000000006',
 'Custo de IA: quanto custa cada lead qualificado pelo agente',
 'Calcular o custo real da operação de IA e comparar com o custo humano da mesma tarefa.',
 12, 2, true, 10, 'video',
$md$## Gancho
IA é barata até você não medir. Aí vira mais uma assinatura que ninguém sabe pra que serve.

## Promessa
Custo por lead qualificado e por tarefa automatizada.

## Demonstração
1. Liste as assinaturas: modelo de IA, N8N, WhatsApp API, CRM.
2. Divida pelo volume: custo por lead qualificado, por follow-up enviado.
3. Compare com o custo humano da mesma tarefa.
4. Decisão: o que manter, o que cortar.

## Entregável
Planilha de custo por tarefa.$md$,
 'Envie a planilha de custo da sua operação de IA com o custo por lead qualificado e por tarefa automatizada.',
 30),

('7a000000-0000-4000-8000-000000000162', '7a000000-0000-4000-8000-000000000006',
 'LGPD e governança: o que o agente pode guardar, dizer e prometer',
 'Regras mínimas pra operar IA com dados de cliente sem risco jurídico e sem queimar a marca.',
 14, 3, true, 10, 'video',
$md$## Gancho
Um agente que promete desconto que não existe ou guarda CPF sem consentimento é problema jurídico, não técnico.

## Promessa
Política de uso de IA da sua empresa em 1 página.

## Demonstração
1. O que o agente pode coletar e por quanto tempo.
2. Frases proibidas: promessa de resultado, desconto não autorizado, dado de terceiro.
3. Aviso de atendimento automatizado.
4. Prompt "Política de IA": gera a política de 1 página a partir das suas respostas.

## Entregável
Política de uso de IA publicada.$md$,
 'Envie a política de uso de IA da sua empresa (1 página) com regras de dados, frases proibidas e aviso de automação.',
 30),

('7a000000-0000-4000-8000-000000000163', '7a000000-0000-4000-8000-000000000006',
 'Quando trocar de ferramenta e como não ficar refém',
 'Critérios pra migrar de modelo, de automação ou de CRM sem parar a operação.',
 12, 4, true, 10, 'video',
$md$## Gancho
Ferramenta de IA muda a cada 3 meses. Seu processo não pode mudar junto.

## Promessa
Checklist de troca e a regra de ouro: processo é seu, ferramenta é aluguel.

## Demonstração
1. Sinais de troca: custo subiu, qualidade caiu, dependência de um fornecedor.
2. Como manter prompts, fluxos e dados exportáveis.
3. Migração em paralelo por 2 semanas.

## Entregável
Nenhum entregável obrigatório. Faça o quiz final da trilha.$md$,
 NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- LABORATÓRIO DE AGENTES — biblioteca inicial
-- ---------------------------------------------------------------------
INSERT INTO public.ia_academy_lab_items
  (slug, title, category, crescer_phase, description, prompt_text, tools, track_id, sort_order)
VALUES
('contexto-da-empresa', 'Contexto da empresa (instruções de projeto)', 'template', 'cenario',
 'Cole nas instruções do projeto do ChatGPT ou Claude. Tudo que a IA precisa saber antes de qualquer tarefa.',
$md$Você vai trabalhar como parte do time comercial da empresa abaixo. Use este contexto em toda resposta.

EMPRESA: [nome]
O QUE VENDE: [produto/serviço em 1 frase]
PRA QUEM (ICP): [perfil do cliente ideal]
TICKET MÉDIO: [valor]
CICLO DE VENDA: [dias]
CANAIS DE ENTRADA: [Instagram, indicação, anúncio...]
DIFERENCIAL: [por que escolhem a gente]
TOM DE VOZ: direto, sem jargão, sem promessa de resultado, frases curtas.
NUNCA: prometer resultado, dar desconto não autorizado, inventar dados.$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000000', 1),

('prompt-5-blocos', 'Estrutura de prompt em 5 blocos', 'prompt', 'cenario',
 'A base de todo prompt da UNV: papel, contexto, tarefa, formato, critério.',
$md$PAPEL: Você é [função] com [experiência].
CONTEXTO: [cole o contexto da empresa]
TAREFA: [o que precisa ser feito, em 1 frase]
FORMATO: [estrutura exata da resposta: seções, quantidade, tamanho]
CRITÉRIO: [o que define uma resposta boa; o que não pode acontecer]$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000000', 2),

('mapeador-de-processo', 'Mapeador de processo comercial', 'prompt', 'cenario',
 'Transforma uma descrição falada do processo atual em etapas com dono, ferramenta e buracos.',
$md$PAPEL: Você é um consultor de processos comerciais.
TAREFA: A partir da transcrição abaixo, mapeie o processo comercial atual da empresa.
FORMATO: Tabela com colunas: etapa, o que acontece, quem faz, ferramenta, tempo médio, critério de passagem (ou "sem critério"). Depois, liste as 3 etapas mais críticas (sem dono ou sem critério) e por quê. Por fim, gere o fluxograma em Mermaid.
CRITÉRIO: Descreva o processo REAL, não o ideal. Onde houver contradição na transcrição, aponte.

TRANSCRIÇÃO:
[cole aqui]$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000001', 3),

('raio-x-comercial', 'Raio-X Comercial (7 dimensões, escore 0 a 70)', 'prompt', 'cenario',
 'Diagnóstico guiado da UNV. A IA faz as perguntas uma por vez e calcula o escore.',
$md$PAPEL: Você é um diretor comercial aplicando o Raio-X Comercial da UNV.
TAREFA: Conduza um diagnóstico em 7 dimensões (público, funil, abordagem, objeção, follow-up, rotina, meta). Faça UMA pergunta por vez, espere a resposta, e só então vá para a próxima. 2 perguntas por dimensão.
FORMATO FINAL: nota de 0 a 10 por dimensão com justificativa em 1 linha, escore total de 0 a 70, a dimensão prioritária (menor nota com maior impacto em receita) e a primeira ação recomendada.
CRITÉRIO: Seja direto. Não elogie. Nota alta exige evidência (processo escrito, número medido).

Comece pela primeira pergunta.$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000001', 4),

('analista-de-funil', 'Analista de funil (CSV do CRM)', 'prompt', 'cenario',
 'Lê o export do CRM e devolve taxas de passagem, tempo por etapa e o gargalo com número.',
$md$PAPEL: Você é um analista de operações comerciais.
TAREFA: Analise o arquivo de negócios anexado (últimos 90 dias).
FORMATO: 1) leads por origem; 2) taxa de passagem entre cada etapa; 3) tempo médio em cada etapa; 4) motivos de perda agrupados; 5) a frase do gargalo: "Perdemos X leads por mês na etapa Y porque Z"; 6) 3 ações, da mais barata à mais cara.
CRITÉRIO: Só use os dados do arquivo. Se faltar coluna (ex.: data de mudança de etapa), diga o que precisa ser registrado a partir de hoje.$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000001', 5),

('construtor-de-icp', 'Construtor de ICP', 'prompt', 'cenario',
 'Cruza melhores e piores clientes e devolve o perfil ideal e os critérios de desqualificação.',
$md$PAPEL: Você é um estrategista comercial.
TAREFA: Com base nos 10 melhores e 5 piores clientes abaixo, construa o perfil de cliente ideal (ICP).
FORMATO: ICP em 1 parágrafo; 5 sinais de que o lead é ideal; 5 critérios de desqualificação; 3 perguntas que o SDR deve fazer pra identificar cada caso.
CRITÉRIO: Padrões concretos (segmento, tamanho, momento, comportamento), não adjetivos.

MELHORES: [lista]
PIORES: [lista]$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000001', 6),

('funil-reverso', 'Funil reverso da meta', 'prompt', 'estrutura',
 'Quebra a meta de faturamento em atividade diária por vendedor.',
$md$TAREFA: Calcule o funil reverso.
DADOS: meta de faturamento do trimestre [R$], ticket médio [R$], taxa lead→conversa [%], conversa→proposta [%], proposta→venda [%], número de vendedores [n], dias úteis [n].
FORMATO: vendas, propostas, conversas e leads necessários no trimestre, no mês, na semana e por vendedor por dia. Depois, diga se a capacidade cabe na agenda (considere 6h produtivas por dia) e, se não couber, qual alavanca mexer primeiro: conversão, volume ou time.$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000002', 7),

('gerador-de-playbook', 'Gerador de playbook UNV (6 etapas)', 'prompt', 'estrutura',
 'Prospecção, qualificação, diagnóstico, proposta, fechamento, handoff. Com dono, critério de saída e métrica.',
$md$PAPEL: Você é o diretor comercial da empresa (contexto do projeto).
TAREFA: Escreva o playbook de vendas em 6 etapas: prospecção, qualificação, diagnóstico, proposta, fechamento, handoff.
FORMATO: Para cada etapa: objetivo (1 frase), dono, 3 a 5 ações, critério de saída (o que precisa ser verdade pra avançar), métrica, ferramenta. Máximo 1 página por etapa.
CRITÉRIO: Regra inegociável: ninguém avança etapa sem cumprir o critério. Linguagem de execução, não de teoria. Depois de escrever, assuma o papel de um vendedor cético e aponte onde isso trava na prática.

INSUMOS: ICP [cole], funil reverso [cole], processo atual [cole].$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000002', 8),

('minerador-de-objecoes', 'Minerador de objeções (conversas reais)', 'prompt', 'estrutura',
 'Lê conversas de WhatsApp e devolve as objeções reais com frequência e resposta pronta.',
$md$TAREFA: Leia as conversas abaixo (anonimizadas) e liste as objeções reais dos clientes.
FORMATO: Tabela: objeção (nas palavras do cliente), frequência, o que ela esconde, resposta consultiva (2 frases), resposta direta (1 frase). Ordene por frequência.
CRITÉRIO: Não invente objeção que não apareceu. Respostas sem promessa de resultado e sem desconto.

CONVERSAS:
[cole]$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000002', 9),

('fluxo-recepcao-whatsapp', 'Fluxo N8N: Recepção WhatsApp', 'n8n_flow', 'captacao',
 'Primeiro fluxo: recebe a mensagem, identifica se é lead novo e responde. Importe o JSON no N8N e troque o número.',
 NULL, '{n8n,whatsapp}', '7a000000-0000-4000-8000-000000000003', 10),

('agente-sdr-unv', 'Agente SDR UNV (prompt + fluxo)', 'agent', 'captacao',
 'O agente que qualifica em 4 perguntas, não vende, grava no CRM e passa pro closer. Prompt pronto pra colar no nó de IA do N8N.',
$md$Você é o(a) assistente comercial da [EMPRESA]. Seu trabalho é QUALIFICAR o lead, não vender.

CONTEXTO DA EMPRESA: [cole]
PERFIL DE CLIENTE IDEAL: [cole]
CRITÉRIOS DE DESQUALIFICAÇÃO: [cole]

FAÇA, UMA POR VEZ, AS 4 PERGUNTAS:
1. Quem é você e qual é a sua empresa? (nome, segmento, tamanho)
2. O que você precisa resolver hoje? (dor em palavras do lead)
3. Pra quando? (urgência)
4. Qual faixa de investimento faz sentido? (orçamento)

REGRAS:
- Máximo 8 mensagens. Mensagens curtas, 1 pergunta por vez.
- Nunca prometa resultado, prazo ou desconto.
- Se o lead pedir pra falar com uma pessoa, encerre com: "Vou te passar agora pro [nome do closer]."
- Se o lead estiver fora do ICP, agradeça e encerre com educação.
- Ao final, gere um JSON: {"nome","empresa","dor","urgencia","orcamento","qualificado":true/false,"resumo_3_linhas"}.

Tom: direto, educado, sem emoji, sem "perfeito" ou "ótimo".$md$,
 '{n8n,whatsapp,claude,chatgpt}', '7a000000-0000-4000-8000-000000000003', 11),

('pesquisador-de-empresa', 'Pesquisador de empresa (prospecção)', 'prompt', 'captacao',
 'Resume o que a empresa faz, sinais de dor e o gancho de abertura.',
$md$TAREFA: Pesquise a empresa [nome / site / Instagram] e devolva: o que faz (1 frase), pra quem vende, 3 sinais de dor comercial visíveis (ex.: responde devagar, sem prova social, sem oferta clara), 1 gancho de abertura específico pra primeira mensagem.
CRITÉRIO: Nada genérico. Se não achar informação, diga.$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000003', 12),

('cadencia-follow-up', 'Cadência de follow-up (5 toques)', 'prompt', 'conversao',
 '5 mensagens com motivo real pra voltar, no tom da empresa.',
$md$TAREFA: Escreva uma cadência de 5 follow-ups para a etapa [proposta enviada] do funil.
FORMATO: Dia 1, 3, 5, 8 e 12. Cada mensagem com no máximo 3 linhas e um MOTIVO real pra voltar (novidade, dúvida, caso parecido, prazo, encerramento).
CRITÉRIO: Proibido "passando pra saber se viu". Sem pressão artificial. A última mensagem fecha a porta com elegância e deixa o caminho aberto.$md$,
 '{chatgpt,claude,n8n}', '7a000000-0000-4000-8000-000000000004', 13),

('avaliador-de-call', 'Avaliador de call UNV', 'prompt', 'conversao',
 'Compara a transcrição da call com o playbook e devolve nota por etapa, 3 correções e 1 acerto.',
$md$PAPEL: Você é o diretor comercial avaliando uma call do time.
TAREFA: Compare a transcrição abaixo com o playbook (etapas e critérios).
FORMATO: nota de 0 a 10 por etapa do playbook com a evidência na fala; 3 correções objetivas (o que falar diferente, com a frase sugerida); 1 acerto a repetir; nota final.
CRITÉRIO: Avalie contra o processo, não contra o gosto pessoal. Seja específico.

PLAYBOOK: [cole]
TRANSCRIÇÃO: [cole]$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000004', 14),

('gerador-de-proposta', 'Gerador de proposta a partir do diagnóstico', 'prompt', 'conversao',
 'Da anotação da reunião à proposta personalizada no template da empresa.',
$md$TAREFA: Escreva a proposta comercial a partir das anotações da reunião de diagnóstico.
FORMATO: 1) contexto do cliente nas palavras dele; 2) o problema e o custo de não resolver; 3) a solução em etapas; 4) investimento e condições; 5) próximos passos com data. Máximo 2 páginas.
CRITÉRIO: Sem promessa de resultado. Use o template da empresa. Tom direto.

ANOTAÇÕES: [cole]$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000004', 15),

('agente-gestor', 'Agente gestor (cobrança de cadência no WhatsApp)', 'agent', 'escala',
 'Todo dia às 17h pergunta as atividades a cada vendedor, consolida e manda pro gestor. Prompt do nó de IA + fluxo N8N.',
$md$Você é o assistente de gestão comercial da [EMPRESA].

TODO DIA ÀS 17H, para cada vendedor: pergunte em 1 mensagem: "Fecha o dia comigo: leads novos, conversas, propostas enviadas e vendas de hoje?" Aceite resposta em texto livre e extraia os 4 números.

CONSOLIDE e envie ao gestor: tabela por vendedor, total do dia, comparação com a meta diária do funil reverso [cole], e 1 frase sobre quem está abaixo e o que fazer amanhã.

SEXTA: resumo da semana com tendência e os 3 deals parados há mais tempo.

Tom: direto, sem elogio vazio, sem emoji.$md$,
 '{n8n,whatsapp,claude,chatgpt}', '7a000000-0000-4000-8000-000000000005', 16),

('leitura-semanal-do-dono', 'Leitura semanal do dono (6 números)', 'prompt', 'escala',
 'Recebe ticket, conversão, CAC, LTV, churn e NPS e devolve o que mudou e a ação da semana.',
$md$TAREFA: Leia os 6 números desta semana contra a semana anterior e o mês.
FORMATO: o que mudou (3 linhas), por que provavelmente mudou (2 hipóteses), a ÚNICA ação da semana, e o que medir pra confirmar.
CRITÉRIO: Uma ação. Não liste cinco.

NÚMEROS: ticket médio [ ], conversão [ ], CAC [ ], LTV [ ], churn [ ], NPS [ ].
SEMANA ANTERIOR: [ ].$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000005', 17),

('auditor-de-conversas', 'Auditor de conversas do agente', 'prompt', 'revisao',
 'Lê uma amostra de conversas do agente e aponta onde saiu do script.',
$md$TAREFA: Audite as 20 conversas abaixo do agente SDR contra o prompt dele.
FORMATO: tabela: conversa, saiu do script? (sim/não), onde, gravidade (baixa/média/alta), ajuste sugerido no prompt. Depois, os 3 ajustes que resolvem a maioria dos casos.
CRITÉRIO: Cite a frase exata do agente.

PROMPT DO AGENTE: [cole]
CONVERSAS: [cole]$md$,
 '{chatgpt,claude}', '7a000000-0000-4000-8000-000000000006', 18),

('checklist-auditoria-mensal', 'Checklist de auditoria mensal de IA', 'checklist', 'revisao',
 'Os 10 itens pra revisar todo mês em 30 minutos.',
$md$[ ] Volume de conversas de cada agente no mês
[ ] Taxa de handoff pra humano
[ ] 20 conversas auditadas (prompt "Auditor de conversas")
[ ] Ajustes no prompt feitos e versionados
[ ] Custo por lead qualificado calculado
[ ] Assinaturas revisadas (manter / cortar)
[ ] Follow-ups enviados × respondidos
[ ] Incidentes (promessa indevida, dado sensível) registrados
[ ] Política de IA ainda válida
[ ] Próxima implementação escolhida$md$,
 '{}', '7a000000-0000-4000-8000-000000000006', 19)
ON CONFLICT (slug) DO NOTHING;
