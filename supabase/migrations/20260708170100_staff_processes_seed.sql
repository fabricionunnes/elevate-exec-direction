-- Seed inicial do Manual de Processos UNV.
-- Conteúdo em markdown; editável direto na página /processos por master/admin.
INSERT INTO public.staff_processes (title, slug, sector, roles, summary, content, tags, sort_order) VALUES

-- ══════════════ COMERCIAL ══════════════
('Filosofia de venda UNV', 'filosofia-de-venda', 'Comercial', '{}',
'Como a UNV vende: diagnóstico antes da oferta. Venda é consequência, não pressão.',
$md$## Princípio
A UNV nunca começa vendendo. O processo é sempre:

1. **Diagnóstico** — entender funil, jornada, gargalos e concorrência do lead
2. **Clareza do problema** — o lead precisa enxergar o próprio gargalo antes de ouvir preço
3. **Direcionamento** — mostrar o caminho, com métrica
4. **Oferta** — só entra quando o problema está claro e quantificado

## Crenças operacionais
- "Venda é consequência, não pressão."
- "Sistema bem estruturado escala. Improviso não escala."
- "Reunião sem métrica é terapia em grupo."
- "Vendedor que só bate meta quando o dono entra é figurante."

## O que nunca fazer
- Mandar proposta sem diagnóstico
- Dar desconto antes de defender valor com ROI
- Prometer resultado sem estruturar processo
$md$, '{venda,cultura,diagnostico}', 1),

('Processo comercial ponta a ponta', 'processo-comercial-ponta-a-ponta', 'Comercial', '{sdr,closer,bdr,social_setter,head_comercial}',
'O funil da UNV do lead ao contrato: quem faz o quê em cada etapa.',
$md$## Etapas do funil
1. **Captação** — tráfego pago, prospecção ativa (BDR), social selling (Social Setter) e indicações
2. **Qualificação (SDR)** — BANT no discador, agenda a reunião pro closer
3. **Sessão estratégica / diagnóstico (Closer)** — reunião com transcrição, dossiê e diagnóstico
4. **Proposta** — gerada na aba Proposta do lead (a IA extrai valor e forma de pagamento da transcrição)
5. **Fechamento** — contrato via gerador de contratos + assinatura
6. **Passagem pro CS** — kickoff e onboarding do cliente

## Regra de venda no CRM
Venda contada = negociação **"won" na etapa Fechado** do funil. A data que vale é `closed_at` (data do fechamento), não a data de criação do lead.

## Ferramentas por etapa
- Discador (fila, brief, qualificação e coach de IA)
- Agenda Google integrada ao CRM (reuniões caem na agenda do closer)
- Transcrição automática das reuniões do Meet (fechamento diário às 20h)
$md$, '{funil,crm,venda,etapas}', 2),

('Playbook do SDR', 'playbook-sdr', 'Comercial', '{sdr}',
'Qualificação BANT em 5 etapas no discador, com tarefas de playbook no CRM.',
$md$## Objetivo do SDR
Qualificar rápido e agendar reunião com decisor pro closer. SDR não vende — SDR qualifica e agenda.

## Método: BANT
- **Budget** — a empresa fatura acima de R$50 mil/mês? Tem verba pra investir?
- **Authority** — estou falando com o dono/decisor?
- **Need** — qual a dor? (não bate meta, sem previsibilidade, conversão baixa, dependência do dono)
- **Timing** — quando quer resolver?

## As 5 etapas da ligação
1. Abertura com contexto (por que estou ligando pra VOCÊ)
2. Diagnóstico rápido — 3 perguntas de dor
3. Qualificação BANT
4. Pitch da sessão estratégica (vender a reunião, não o serviço)
5. Agendamento na hora, com convite disparado na ligação

## Ferramentas
- **Discador do CRM**: brief do lead antes da ligação, qualificação assistida e coach de IA em tempo real
- **Tarefas "Playbook ·"** nos funis SE/SS: siga a sequência, não pule etapa
- Reunião agendada = convite na agenda do closer via integração Google
$md$, '{sdr,bant,discador,qualificacao}', 3),

('Rotina diária do Closer', 'rotina-closer', 'Comercial', '{closer,head_comercial}',
'Agenda, dossiê, condução da sessão, proposta e follow-up.',
$md$## Antes da reunião
- Revisar o **dossiê do lead** (histórico, transcrições anteriores, dor mapeada pelo SDR)
- Conferir agenda do dia no CRM

## Na reunião (sessão estratégica)
- Conduzir pelo diagnóstico: funil, jornada, gargalos, concorrência
- Quantificar a dor em dinheiro (quanto custa não resolver)
- Reunião sempre com transcrição ativa (Meet) — vira insumo da proposta

## Depois da reunião
1. Salvar/conferir a transcrição no lead
2. Gerar a **proposta na aba Proposta** — a IA extrai valor e forma de pagamento da conversa; conferir antes de enviar
3. Registrar próxima atividade no CRM (follow-up com data)
4. Fechou? Gerar contrato no gerador de contratos e mover o lead pra etapa **Fechado**

## Regras
- Lead sem próxima atividade agendada = lead perdido
- Proposta enviada sem follow-up marcado não existe
- Remarcação de reunião: usar a ação de reagendar (mantém dono e link) — nunca criar reunião duplicada
$md$, '{closer,proposta,reuniao,followup}', 4),

('Sessão Estratégica — captação e condução', 'sessao-estrategica', 'Comercial', '{sdr,closer,social_setter,marketing}',
'Porta de entrada padrão do funil: landing /sessao, agendamento e roteiro.',
$md$## O que é
Reunião gratuita de diagnóstico comercial — a porta de entrada padrão da UNV.

## Captação
- Landing page **unvholdings.com.br/sessao** (nome + WhatsApp, cai direto no funil do CRM)
- Tráfego pago, social e prospecção ativa apontam pra essa página

## Fluxo
1. Lead preenche o formulário → entra no funil com dono definido por round-robin
2. SDR/Social Setter faz contato em até **15 minutos** (lead quente esfria rápido)
3. Qualifica (BANT) e agenda a sessão com o closer
4. Closer conduz o diagnóstico e encaminha proposta

## Roteiro da sessão
- Cenário atual: faturamento, time, funil, ticket médio, conversão
- Gargalo principal (Raio-X Comercial quando aplicável)
- Caminho recomendado + próximo passo claro
$md$, '{sessao,landing,captacao}', 5),

('Uso do CRM — regras da casa', 'uso-do-crm', 'Comercial', '{sdr,closer,bdr,social_setter,head_comercial,cs}',
'Cadastro, distribuição, etiquetas, atividades e o que nunca fazer no CRM.',
$md$## Regras de ouro
- Todo lead tem **dono** — distribuição automática por round-robin quando configurada no funil
- Todo lead tem **próxima atividade** com data
- Etapa reflete a realidade — mover na hora, não no fim do dia
- Venda = etapa **Fechado (won)**; a data que vale é a do fechamento

## Cadastro
- Nome, WhatsApp e origem são obrigatórios
- Empresa: faturamento e nº de vendedores no cadastro (qualifica o ICP: 1+ vendedor, R$50k+/mês)

## Ações em massa
- Mover/mudar funil/atribuir em lote é suportado; automações disparam em lotes de até 50

## Reuniões
- Sempre pela integração da Agenda Google (slots 07h–23h)
- Reagendar = mover o evento (mantém dono e link). Cancelar = excluir. Nunca duplicar.

## O que nunca fazer
- Lead parado sem atividade e sem dono
- Registrar venda fora da etapa Fechado
- Apagar histórico de conversa/transcrição
$md$, '{crm,regras,distribuicao,agenda}', 6),

('Metas e comissionamento', 'metas-e-comissao', 'Comercial', '{closer,sdr,head_comercial,financeiro,master}',
'Como metas são definidas e como a venda é atribuída ao vendedor.',
$md$## Metas
- Metas mensais por vendedor cadastradas no módulo **Metas & KPIs** (kpi_monthly_targets)
- A projeção do mês da empresa é a soma das metas individuais dos vendedores ativos
- Quem aparece nas metas/vendas do CRM é quem está marcado como **closer de CRM** no cadastro do colaborador

## Atribuição de venda
- A venda conta pro vendedor **atribuído** à negociação no momento do fechamento
- Vendas importadas de histórico não alteram comissão vigente

## Acompanhamento
- Ranking diário automático no grupo (20h30)
- Reunião semanal de metas: sempre com número na mesa — funil, conversão por etapa, ticket médio e projeção
$md$, '{metas,comissao,kpi}', 7),

-- ══════════════ OPERAÇÕES & CLIENTES ══════════════
('Modelo de entrega UNV (os 5 passos)', 'modelo-de-entrega', 'Operações & Clientes', '{cs,consultant,head_comercial}',
'O padrão de entrega de todo projeto: diagnóstico → plano 6 meses → vitória rápida → rotina → treinamento.',
$md$## Os 5 passos (todo cliente, sem exceção)
1. **Diagnóstico profundo** — funil, jornada do cliente, gargalos, concorrência
2. **Planejamento mínimo de 6 meses** — plano por fase com metas e responsáveis
3. **Primeira vitória rápida** — gerar confiança cedo; ROI visível em 3 a 5 meses
4. **Rotina de gestão contínua** — reuniões periódicas com métrica (ticket médio, conversão, CAC, LTV, NPS)
5. **Treinamento contínuo dos vendedores** — playbook, role play e acompanhamento

## Por que nessa ordem
Cliente renova quando enxerga resultado com processo. A vitória rápida compra tempo pra estruturação profunda fazer efeito.

## Indicadores de entrega saudável
- NPS alvo: 8+
- Cliente com meta batida ≥100% = saúde no piso 75 (verde)
- Reunião de gestão sem métrica não conta como entrega
$md$, '{entrega,onboarding,rotina}', 1),

('Método CRESCER™', 'metodo-crescer', 'Operações & Clientes', '{cs,consultant,closer,head_comercial}',
'Metodologia proprietária de crescimento comercial em 7 fases.',
$md$## As 7 fases
1. **C**enário — raio-x da operação atual
2. **R**esultado Ideal — onde o cliente quer chegar (meta quantificada)
3. **E**strutura — time, papéis, ferramentas e processo comercial
4. **S**istema de Captação — canais de geração de demanda previsível
5. **C**onversão — funil, script, follow-up, taxa por etapa
6. **E**scala — aumentar volume com margem, sem quebrar a operação
7. **R**evisão — ciclo de melhoria contínua com métrica

## Ferramenta de diagnóstico
**Raio-X Comercial** — escore de 0 a 70 que posiciona o cliente nas fases e prioriza o plano.

## Uso
- Na venda: estrutura o diagnóstico da sessão estratégica
- Na entrega: vira o roadmap dos 6 meses do projeto
$md$, '{crescer,metodologia,diagnostico}', 2),

('Onboarding de cliente novo', 'onboarding-cliente-novo', 'Operações & Clientes', '{cs,consultant,admin}',
'Do contrato assinado ao kickoff: cadastro no Nexus, grupo de WhatsApp e primeiras entregas.',
$md$## Checklist (na semana da assinatura)
1. **Cadastro no Nexus**: empresa + projeto com serviço correto, valor de contrato e telefone do dono (owner_phone — sem ele o cliente fica fora dos relatórios automáticos de vitória)
2. **Grupo de WhatsApp** com o cliente criado e **vinculado à empresa no sistema** (grupo de gestão com company_id) — sem esse vínculo o cliente fica fora do resumo diário e dos relatórios do Marcelo
3. **Kickoff agendado** (reunião de abertura com dono + time)
4. Acessos: CRM do cliente, dashboards, formulários de mapeamento
5. Diagnóstico profundo iniciado (fase Cenário do CRESCER)

## Kickoff — pauta padrão
- Apresentação do time UNV e canais de comunicação
- Expectativas e metas dos primeiros 90 dias
- Cronograma do plano de 6 meses
- Primeira vitória rápida definida com data

## Erros que geram churn precoce
- Cadastro incompleto no Nexus (cliente "invisível" pros rituais automáticos)
- Kickoff atrasado ou sem o dono presente
- Primeira entrega sem data combinada
$md$, '{onboarding,kickoff,cadastro,whatsapp}', 3),

('Rotina do consultor / CS', 'rotina-consultor-cs', 'Operações & Clientes', '{cs,consultant}',
'Rituais diários e semanais de gestão da carteira.',
$md$## Diário
- **Copiloto de Resultados** (dias úteis, 7h30): sugere 1–3 ações prioritárias por consultor — executar ou justificar
- Responder grupos de clientes; nenhuma mensagem de cliente passa do dia sem resposta
- Resumo diário de gestão sai automático nos grupos às 19h30 (seg–sáb) — conferir se o do seu cliente saiu

## Semanal
- Reunião de gestão com cada cliente ativo, **sempre com métrica** (funil, conversão, ticket médio, CAC quando houver tráfego)
- **Relatório de Vitória** automático pro dono (segunda 8h) — validar que o cliente tem owner_phone cadastrado
- Revisar semáforo de saúde da carteira e agir nos amarelos/vermelhos

## Mensal
- Revisão do plano de 6 meses (fase do CRESCER, metas, próximos 30 dias)
- Registrar evolução no Nexus (KPIs do cliente atualizados)

## Postura
- Consultor é diretor comercial do cliente, não suporte
- Toda reunião termina com decisão e responsável — "reunião sem métrica é terapia em grupo"
$md$, '{rotina,cs,copiloto,relatorio}', 4),

('Saúde do cliente — semáforo', 'saude-do-cliente', 'Operações & Clientes', '{cs,consultant,head_comercial,master}',
'Como o score verde/amarelo/vermelho é calculado e o que fazer em cada cor.',
$md$## Como o score é calculado
O sistema cruza três dimensões, com **resultado mandando mais**:
- **Resultado**: meta do cliente — meta batida (≥100%) garante piso 75 (verde)
- **Engajamento**: presença e resposta no WhatsApp + participação nas reuniões
- **Entrega**: tarefas e ações do projeto em dia

Recalculado automaticamente todo dia de manhã. Visível no painel de clientes (/onboarding-tasks).

## O que fazer por cor
- **Verde** — manter ritmo; usar nos cases e pedir indicação
- **Amarelo** — agir na semana: reunião extra, revisar plano, entender queda de engajamento
- **Vermelho** — tratamento de risco: consultor + gestão juntos, plano de recuperação com data, avisar diretoria

## Radar de churn
O motor de retenção roda diariamente (7h) e alerta os masters no WhatsApp com o top de risco. Amarelo/vermelho recorrente entra no playbook de retenção.
$md$, '{saude,churn,semaforo,score}', 5),

('Playbook de retenção e cancelamento', 'retencao-e-cancelamento', 'Operações & Clientes', '{cs,consultant,master,admin,financeiro}',
'Como responder a um pedido de cancelamento: diagnóstico do motivo antes de qualquer resposta.',
$md$## Regra nº 1
Pedido de cancelamento **não se responde com aceite nem com desconto**. Se responde com diagnóstico.

## Passo a passo
1. **Entender o motivo real** — na maioria dos casos é caixa do cliente, não insatisfação com a entrega. São tratamentos diferentes.
2. **Levantar os números do projeto** — ROI entregue, leads gerados, vendas atribuídas, evolução vs. início
3. **Montar diagnóstico de retenção** (PDF curto): o que foi entregue, o que muda se cancelar, alternativas
4. **Reunião de retenção** com o dono — apresentar números, não súplica
5. Alternativas na mesa: redução de escopo temporária, pausa negociada com data de retorno, renegociação de fluxo

## Se for caixa (mais comum)
- Mostrar o custo de desligar a máquina (ex.: reduzir tráfego = menos leads = menos caixa — espiral)
- Propor degrau menor em vez de desligamento total
- Registrar data de retomada combinada

## Se for insatisfação
- Assumir, corrigir rota com plano de 30 dias e patrocínio da diretoria

## Sempre
- Registrar motivo e desfecho no Nexus (alimenta o radar de churn)
- Cancelamento confirmado → registrar churn_date no projeto e comunicar financeiro (suspende régua e recorrência)
$md$, '{churn,retencao,cancelamento}', 6),

('Renovação de contrato', 'renovacao-de-contrato', 'Operações & Clientes', '{cs,consultant,financeiro,master}',
'Quando e como conduzir a renovação — começa 60 dias antes do fim.',
$md$## Linha do tempo
- **D-60**: consultor revisa resultados do ciclo e prepara o case de renovação (números do próprio cliente)
- **D-45**: reunião de resultados com o dono — mostrar evolução vs. baseline e plano do próximo ciclo
- **D-30**: proposta de renovação formalizada (contrato novo no gerador)
- **D-15**: sem resposta = escalar pra diretoria

## O que sustenta renovação
- Rotina de gestão cumprida (reuniões com métrica, relatórios entregues)
- Vitórias documentadas ao longo do ciclo — não só no fim
- NPS acompanhado (alvo 8+); detrator tratado na hora, não na renovação

## Painel
Renovações e vencimentos ficam em /onboarding-tasks (Renovações). Cliente sem movimentação lá é risco silencioso.
$md$, '{renovacao,contrato,nps}', 7),

-- ══════════════ FINANCEIRO ══════════════
('Cobrança e régua de faturas', 'cobranca-e-regua', 'Financeiro', '{financeiro,admin,master}',
'Como funciona a cobrança dos clientes: faturas, Asaas e régua automática de WhatsApp.',
$md$## Estrutura
- A cobrança dos clientes roda em **faturas de empresa** (company_invoices) geradas a partir das recorrências — não confundir com o contas a receber interno
- Pagamento via **Asaas** (PIX/boleto/cartão); o webhook dá baixa automática quando o pagamento cai
- Fatura marcada como paga **nunca** volta pra vencida/pendente (trava no sistema)

## Régua automática
- Lembretes e cobranças saem por WhatsApp conforme a régua configurada
- **Cliente encaminhado pro Jurídico = régua de WhatsApp suspensa automaticamente** (não cobrar por mensagem quem está em tratativa jurídica)

## Rotina do financeiro
- Conferir diariamente o monitor de parcelas e inadimplência
- Divergência Asaas x fatura: usar as ações "Excluir ajuste" / "Distribuir ajuste" nas Contas a Receber — nunca editar saldo na mão
- Inadimplente 30+ dias: alinhar com CS antes de escalar (pode ser caso de retenção em andamento)
$md$, '{cobranca,asaas,regua,inadimplencia}', 1),

('Regra de MRR', 'regra-de-mrr', 'Financeiro', '{financeiro,master,admin}',
'O que entra e o que não entra no MRR da UNV.',
$md$## Regra
- **MRR = somatório dos contratos mensais ativos** (contract_value do projeto)
- Contratos fechados em cartão parcelado (6/12 meses) **não entram** no MRR — são receita pontual
- Churn do MRR = data de churn registrada no projeto (churn_date)

## Onde ver
- Painel **MRR do Mês** em /onboarding-tasks/mrr (acesso master)

## Cuidados
- Valor do contrato errado no cadastro distorce o MRR — conferir contract_value no onboarding de cada cliente novo
- Campos monetários no sistema: apenas os campos com sufixo `_cents` são centavos; o resto é valor em reais
$md$, '{mrr,receita,metricas}', 2),

('Contas, orçamento e fechamento mensal', 'financeiro-fechamento', 'Financeiro', '{financeiro,master}',
'Contas a pagar/receber, plano de contas, orçamento e o fechamento do mês.',
$md$## Estrutura no Nexus
- Módulo Financeiro: contas a receber, contas a pagar, DRE, DFC, bancos e recorrências
- **Plano de contas vivo** = categorias do módulo staff (as categorias usadas nos lançamentos do dia a dia)
- **Planejamento orçamentário**: aba Planejamento — orçado por categoria x realizado (puxa das contas a pagar)

## Rotina mensal (até o dia 5)
1. Conciliar Asaas x faturas x extrato
2. Categorizar 100% dos lançamentos do mês anterior
3. Fechar DRE e DFC do mês
4. Revisar orçado x realizado por categoria e reportar desvios à diretoria
5. Atualizar projeção de caixa do trimestre

## Princípios
- Margem antes de receita: crescimento sem margem não passa no filtro de decisão
- Dívida de tráfego e fluxo de caixa são pontos de atenção permanentes — visibilidade semanal pra diretoria
$md$, '{dre,dfc,orcamento,fechamento}', 3),

-- ══════════════ MARKETING ══════════════
('Tráfego pago — operação e métricas', 'trafego-pago', 'Marketing', '{marketing,head_comercial,master}',
'Como a UNV roda tráfego (interno e de clientes): CAC alvo, tripwire e dashboards.',
$md$## Princípios
- Tráfego é máquina de previsibilidade, não aposta: **todo funil tem CAC máximo definido antes de escalar** (tripwire — ex.: UNV Start opera com CAC máximo de R$30)
- Estourou o teto por X dias seguidos → pausa e revisão de criativo/página/oferta, não "mais verba"

## Operação
- Dashboards de tráfego no CRM: leads e vendas por funil — venda atribuída pela **data de fechamento**, só etapa Fechado
- Rastreamento de ponta a ponta é obrigatório em campanha nova (UTM + origem no CRM); campanha sem rastreio não escala
- Leads de Meta caem no CRM via integração; conferir a sincronização quando o volume cair de repente

## Pra clientes
- Relatórios automáticos diários por WhatsApp quando configurado (padrão Clínica Main)
- Métrica reportada tem que ser a que move o negócio do cliente (ex.: conversa iniciada, agendamento), não impressão/clique
$md$, '{trafego,cac,meta,dashboards}', 1),

('Conteúdo e social — padrão UNV', 'conteudo-e-social', 'Marketing', '{marketing,social_setter}',
'Estilo de conteúdo, tom de voz e formato de vídeo da marca.',
$md$## Formato de vídeo
Estilo **lo-fi**: câmera estática, fundo real, fala direta. Sem música, sem corte rápido, sem vinheta. Autoridade vem da clareza, não da produção.

## Tom de voz
- Direto, humano, sem parecer robô. Sem emojis em contexto operacional.
- Uma mensagem = uma intenção
- Mensagens de marca que funcionam: "reunião sem métrica é terapia em grupo", "vendedor que só bate meta quando o dono entra é figurante"

## Identidade visual
- **UNV**: navy #0D2B5E, vermelho #CC1B1B, branco/cinza claro
- **Mansão Empreendedora**: dark luxury — preto #0A0A0A, dourado #C9A84C, creme #E8D5A3

## Social selling
- Social Setter atua no Instagram: abordagem consultiva, direciona pra sessão estratégica
- Métricas de Instagram disponíveis via integração no sistema
$md$, '{conteudo,social,video,identidade}', 2),

-- ══════════════ PESSOAS & RH ══════════════
('Recrutamento e seleção', 'recrutamento-e-selecao', 'Pessoas & RH', '{rh,admin,master}',
'Fluxo de vaga aberta a contratação usando o UNV Profile.',
$md$## Fluxo
1. **Abrir a vaga** no UNV Profile (/onboarding-tasks/vagas): descrição, requisitos, perfil comportamental
2. Divulgar o **link público da vaga** (candidato aplica sem login)
3. Triagem: currículo + DISC quando aplicável
4. Entrevistas: RH (fit cultural) → gestor da área (técnica) → proposta
5. Aprovado → contrato de colaborador no gerador de contratos (/contratos/colaboradores)

## Banco de talentos
Candidato bom sem vaga aberta vai pro banco de talentos — é a primeira fonte de busca antes de abrir vaga nova.

## Perfil que a UNV contrata
- Orientado a resultado e métrica (pergunta "quanto", não só "o quê")
- Execução > teoria; baixa necessidade de supervisão
- Comercial: histórico de meta batida comprovável
$md$, '{recrutamento,vagas,disc,talentos}', 1),

('Onboarding de colaborador novo', 'onboarding-colaborador', 'Pessoas & RH', '{rh,admin,master}',
'Primeiro dia ao primeiro mês: acessos, manual e ramp-up por cargo.',
$md$## Semana 1 — acessos e contexto
1. Cadastro no Nexus como staff (cargo correto — o cargo define permissões de menu)
2. Acessos: Nexus, CRM, WhatsApp corporativo, e-mail, grupos internos
3. **Ler este manual (unvholdings.com.br/processos)** — começar pelos processos do próprio setor e cargo
4. Apresentação ao time e ao UNV Office

## Semana 2–4 — ramp-up por cargo
- **Comercial (SDR/Closer)**: playbook do cargo, escuta de ligações/reuniões gravadas, role play, primeira semana com meta reduzida
- **CS/Consultor**: acompanhar reuniões de gestão de um consultor sênior em 2+ clientes antes de assumir carteira
- **Financeiro/RH/Marketing**: rotina do setor com o gestor + processos deste manual

## Regra
Colaborador com cargo "pending" no sistema ainda não foi aprovado — aprovar no painel de staff assim que confirmado.

## 30 dias
Conversa de alinhamento com gestor: o que aprendeu, onde travou, meta dos próximos 60 dias.
$md$, '{onboarding,acessos,rampup}', 2),

-- ══════════════ EVENTOS ══════════════
('Padrão de eventos UNV', 'padrao-de-eventos', 'Eventos', '{marketing,admin,master}',
'Como a UNV faz evento: Growth Room, Mansão Empreendedora e imersões. Prazos, brindes e dinâmicas.',
$md$## Portfólio de eventos
- **UNV Growth Room** — eventos recorrentes de comunidade/networking
- **Mansão Empreendedora** — experiência presencial high ticket (dark luxury: preto + dourado)
- **Imersões** (ex.: Imersão CRESCER) — dia inteiro de método aplicado

## Prazos não negociáveis
- **Brindes: cotação com 30–35 dias de antecedência.** Padrão premium: alumínio preto fosco + gravação a laser dourada + caixa preta com selo. Nunca saco plástico.
- Materiais de marca (roll-up, backdrop, crachá, deck) prontos 15 dias antes
- Confirmação de presença: régua de WhatsApp na semana do evento

## Dinâmicas
- Padrão UNV = **co-criação com entregável tangível** (o participante sai com algo construído — ex.: "Máquina de Vendas em 30 Minutos", Cadeira Quente)
- Formatos passivos (palestra atrás de palestra, auditoria entre pares) não são padrão da casa

## Pós-evento
- Follow-up comercial em até 48h com oferta contextual
- NPS do evento + depoimentos gravados no dia
$md$, '{eventos,brindes,mansao,imersao}', 1),

-- ══════════════ PRODUTO & TECNOLOGIA ══════════════
('Deploy e mudanças no Nexus', 'deploy-nexus', 'Produto & Tecnologia', '{admin,master}',
'Como qualquer mudança entra em produção no Nexus. Regras invioláveis.',
$md$## Frontend
- **Nunca commitar direto na main.** Branch (feat/ ou fix/) → PR → merge
- Merge na main dispara o GitHub Actions, que builda e publica no Cloudflare Worker (unv-nexus → unvholdings.com.br)
- **Nunca** rodar deploy manual (wrangler) da cópia local — o CI é a única via

## Backend (Supabase)
- Migrations com timestamp em supabase/migrations/
- Edge functions deployadas via CI próprio; atenção: função editada fora do CI pode estar mais nova em produção do que no repo — conferir antes de sobrescrever

## Regras de dados
- Campos monetários: só os com sufixo `_cents` são centavos
- Tabelas de cliente white-label: sempre isolar por tenant_id
- Toda tabela nova nasce com RLS habilitado

## Stack
React + Vite + Tailwind + shadcn/ui no frontend; Supabase (Postgres + Edge Functions) no backend; automações em N8N; WhatsApp via API.
$md$, '{deploy,nexus,ci,supabase}', 1),

-- ══════════════ DIRETORIA ══════════════
('Filtro de decisão UNV', 'filtro-de-decisao', 'Diretoria', '{master,admin,head_comercial}',
'As 4 perguntas que toda decisão estratégica precisa passar.',
$md$## O filtro
Toda proposta de projeto, produto, contratação ou investimento responde antes:

1. **O que escala?** — funciona com 10x o volume sem 10x o custo?
2. **O que gera previsibilidade?** — cria receita/resultado recorrente ou é pontual?
3. **O que aumenta margem?** — melhora o lucro ou só o faturamento?
4. **O que reduz dependência?** — do dono, de uma pessoa, de um canal, de um cliente?

Proposta que não passa em pelo menos 2 dos 4 não sobe pra decisão.

## Métricas da diretoria
Ticket médio, conversão, CAC, LTV, churn, NPS e lucro líquido. Metas sempre específicas ("aumentar ticket médio", "reduzir CAC") — nunca "vender mais" genérico.

## Visão
Construir a maior empresa do Brasil em terceirização de gestão comercial, com tecnologia própria e foco total em resultado.
$md$, '{decisao,estrategia,metricas}', 1),

('Portfólio e regras de precificação', 'portfolio-e-precificacao', 'Diretoria', '{closer,head_comercial,master,admin,financeiro}',
'Regras comerciais dos produtos. Os valores vigentes ficam na aba "Produtos & Valores" deste manual — puxados direto do sistema.',
$md$## Onde ver os valores
Os preços vigentes estão na aba **Produtos & Valores** deste manual — puxados em tempo real do catálogo do sistema. **Não usar valor decorado nem planilha antiga.**

## Estrutura do portfólio
- **Núcleo**: Diretor Comercial Terceirizado (produto principal), Sales Force (SDR + Closer), Sales Ops, Sales Acceleration, Sales Core, Sales Control
- **Complementares**: UNV Ads (tráfego), UNV Social, UNV InCompany, UNV People (RH), UNV Finance, UNV Safe (jurídico), UNV Leadership
- **Premium**: UNV Mastermind, UNV Partners, UNV Growth Room, Mansão Empreendedora

## Regras comerciais que não mudam
- **Sales Force** exige 200 leads/mês e tráfego mínimo de R$2k/mês do cliente — sem isso, não vender (a entrega quebra)
- ICP mínimo: 1+ vendedor e faturamento acima de R$50 mil/mês
- Desconto além da alçada do closer → aprovação da diretoria
- Parcelamento em cartão (6/12x) não entra no MRR — tratar como receita pontual no planejamento
$md$, '{portfolio,precos,regras}', 2)

ON CONFLICT (slug) DO NOTHING;
