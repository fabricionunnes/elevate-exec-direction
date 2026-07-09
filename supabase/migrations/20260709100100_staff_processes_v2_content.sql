-- Manual de Processos v2: conteúdo profundo (fluxograma mermaid, tabelas SLA, métricas, checklist)

UPDATE public.staff_processes SET summary = 'Como a UNV vende: diagnóstico antes da oferta. Venda é consequência, não pressão.', content = $md$## Objetivo

Garantir que toda venda da UNV nasça de um diagnóstico, não de um pitch. Quando esse processo é seguido, o lead compra porque enxergou o próprio gargalo e o custo de não resolver — e chega no contrato sem precisar de desconto. Quando falha, viram propostas atiradas no escuro, desconto pra compensar falta de valor e cliente que entra desalinhado e cancela cedo.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| SDR | Aplicar a filosofia desde a primeira ligação: perguntar antes de falar, vender a sessão e não o serviço |
| Closer | Conduzir o diagnóstico completo, quantificar a dor em dinheiro e só então apresentar oferta |
| BDR | Prospectar com contexto: abordar pela dor provável, nunca pelo produto |
| Social Setter | Abordagem consultiva no social, direcionando pra sessão estratégica |
| Head Comercial | Auditar ligações e reuniões, corrigir quem está pulando o diagnóstico |

## Quando roda

Sempre. Não é um processo com gatilho — é a regra que governa todos os outros processos comerciais. Vale em ligação de SDR, sessão estratégica, follow-up, renegociação e renovação. Toda interação com lead ou cliente passa por aqui.

## Fluxo do processo

```mermaid
flowchart TD
    A["Lead entra em contato"] --> B["Diagnóstico: funil, jornada, gargalos, concorrência"]
    B --> C{"Lead enxergou o próprio gargalo?"}
    C -->|"não"| D["Aprofundar perguntas de dor"]
    D --> C
    C -->|"sim"| E["Quantificar o problema em dinheiro"]
    E --> F["Direcionamento: mostrar o caminho com métrica"]
    F --> G{"Problema claro e quantificado?"}
    G -->|"não"| B
    G -->|"sim"| H["Oferta"]
    H --> I{"Pediu desconto?"}
    I -->|"sim"| J["Defender valor com ROI antes de falar em preço"]
    I -->|"não"| K["Fechamento"]
    J --> K
```

## Passo a passo

1. **Diagnóstico primeiro.** Antes de falar de UNV, entenda o negócio do lead: funil, jornada do cliente, gargalos e concorrência. Onde: na ligação (SDR, com apoio do brief do discador) ou na sessão estratégica (closer). Feito quando: você consegue descrever o gargalo do lead melhor do que ele.
2. **Clareza do problema.** O lead precisa enxergar o próprio gargalo antes de ouvir preço. Use perguntas, não afirmações: "quantos leads viram reunião?", "quanto disso depende de você?". Feito quando: o próprio lead verbaliza o problema.
3. **Quantificar a dor.** Transforme o gargalo em número: quanto custa por mês não resolver. Sem número, não avança. Feito quando: existe um valor em reais na mesa que o lead reconheceu.
4. **Direcionamento.** Mostre o caminho com métrica — o que muda, em quanto tempo, medido por quê. Aqui entra o método, não o preço. Feito quando: o lead entendeu o plano antes de ouvir a oferta.
5. **Oferta.** Só entra quando o problema está claro e quantificado. Apresente a solução conectada ao diagnóstico, ponto a ponto. Valores vigentes: aba Produtos & Valores deste manual — nunca de cabeça. Feito quando: a oferta responde diretamente ao gargalo mapeado.
6. **Defesa de valor.** Pediu desconto? Volte pro ROI: compare o investimento com o custo de não resolver que você quantificou no passo 3. Desconto além da alçada do closer sobe pra diretoria. Feito quando: a conversa voltou pra valor, não pra preço.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Diagnóstico na primeira conversa | Na própria ligação ou sessão | SDR / Closer |
| Quantificação da dor | Antes de qualquer oferta, sem exceção | Closer |
| Oferta | Só após problema claro e quantificado | Closer |
| Escalada de desconto fora de alçada | Mesmo dia, pra diretoria | Closer / Head Comercial |
| Auditoria de ligações e reuniões | Semanal | Head Comercial |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Conversão sessão para proposta | Subindo mês a mês | CRM, funil por etapa |
| Propostas enviadas com diagnóstico feito | 100 por cento | Transcrição da reunião no lead |
| Vendas com desconto | Mínimo possível, sempre com aprovação | CRM e diretoria |
| Ticket médio | Crescente | Metas e KPIs |

## Erros comuns

- **Mandar proposta sem diagnóstico.** Consequência: proposta genérica, lead compara por preço, conversão despenca.
- **Dar desconto antes de defender valor com ROI.** Consequência: margem queimada e lead que aprendeu que pressionar funciona.
- **Prometer resultado sem estruturar processo.** Consequência: expectativa impossível, churn precoce e NPS no chão. Sistema bem estruturado escala; improviso não escala.
- **Falar de UNV antes de perguntar do negócio do lead.** Consequência: vira pitch de vendedor comum, exatamente o que a UNV não é.
- **Aceitar "quero pensar" sem quantificar a dor.** Consequência: follow-up sem munição — você não tem número pra retomar a conversa.

## Checklist rápido

- [ ] Diagnóstico feito antes de qualquer menção a preço
- [ ] Lead verbalizou o próprio gargalo com as palavras dele
- [ ] Dor quantificada em reais por mês
- [ ] Caminho apresentado com métrica antes da oferta
- [ ] Valores consultados na aba Produtos & Valores, nunca de memória
- [ ] Pedido de desconto respondido com ROI, não com número menor
- [ ] Desconto fora de alçada escalado pra diretoria no mesmo dia$md$ WHERE slug = 'filosofia-de-venda';

UPDATE public.staff_processes SET summary = 'O funil da UNV do lead ao contrato: quem faz o quê em cada etapa, com ferramenta e regra de venda.', content = $md$## Objetivo

Dar previsibilidade ao funil: todo lead percorre o mesmo caminho, com dono, ferramenta e critério de saída em cada etapa. Quando roda certo, a diretoria sabe quantos leads viram reunião, quantas reuniões viram proposta e quantas propostas viram contrato — e projeta receita com confiança. Quando falha, o funil vira caixa-preta: lead sumido, venda registrada errado e meta que ninguém sabe se vai bater.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Marketing / BDR / Social Setter | Captação: tráfego pago, prospecção ativa, social selling e indicações |
| SDR | Qualificação BANT no discador e agendamento da reunião pro closer |
| Closer | Sessão estratégica, proposta, negociação e fechamento |
| Head Comercial | Gestão do funil, conversão por etapa e destrave de negociações |
| CS | Recebe a passagem de bastão: kickoff e onboarding do cliente novo |

## Quando roda

Gatilho: entrada de qualquer lead no CRM — formulário da landing, tráfego pago, prospecção do BDR, social selling ou indicação. Roda continuamente; cada lead ativo está sempre em uma etapa do funil, com dono e próxima atividade.

## Fluxo do processo

```mermaid
flowchart TD
    A["Captação: tráfego, BDR, social, indicação"] --> B["Lead entra no CRM com dono via round-robin"]
    B --> C["SDR qualifica com BANT no discador"]
    C --> D{"Lead qualificado?"}
    D -->|"não"| E["Descartar com motivo registrado"]
    D -->|"sim"| F["Reunião agendada na agenda do closer"]
    F --> G["Sessão estratégica no Meet com transcrição"]
    G --> H["Proposta gerada por IA na aba Proposta"]
    H --> I{"Lead aceitou?"}
    I -->|"não"| J["Follow-up com data marcada"]
    J --> I
    I -->|"sim"| K["Contrato no gerador e assinatura"]
    K --> L["Lead movido pra etapa Fechado como won"]
    L --> M["Passagem pro CS: kickoff e onboarding"]
```

## Passo a passo

1. **Captação.** Leads chegam por tráfego pago, prospecção ativa do BDR, social selling do Social Setter e indicações. Todos apontam pra sessão estratégica. Onde: CRM, com origem registrada. Feito quando: lead criado com nome, WhatsApp e origem.
2. **Distribuição.** Lead entra no funil com dono definido por round-robin quando configurado no funil. Feito quando: lead tem dono e primeira atividade criada.
3. **Qualificação pelo SDR.** BANT no discador: brief de IA antes da ligação, qualificação assistida durante e coach em tempo real. Detalhe completo no Playbook do SDR. Feito quando: BANT respondido e decisão tomada — agenda ou descarta com motivo.
4. **Agendamento.** Reunião cai direto na agenda do closer via integração da Agenda Google, slots de 07h às 23h, convite disparado ainda na ligação. Feito quando: evento confirmado na agenda do closer e lead movido de etapa.
5. **Sessão estratégica.** Closer conduz o diagnóstico no Meet com transcrição ativa — a transcrição vira insumo da proposta e do dossiê. O fechamento diário das reuniões roda às 20h e importa a transcrição. Feito quando: reunião realizada e transcrição salva no lead.
6. **Proposta.** Gerada na aba Proposta do lead: a IA extrai valor e forma de pagamento da transcrição. O closer confere tudo antes de enviar — IA gera, humano valida. Feito quando: proposta conferida, enviada e follow-up agendado no CRM.
7. **Fechamento.** Aceitou? Contrato gerado no gerador de contratos, enviado pra assinatura. Após assinatura, mover a negociação pra etapa **Fechado** — venda contada é "won" na etapa Fechado, e a data que vale é `closed_at`, não a data de criação do lead. Feito quando: contrato assinado e lead em Fechado com closer atribuído correto.
8. **Passagem pro CS.** Fechou, vira projeto: CS assume pra kickoff e onboarding conforme o processo de Operações. Feito quando: CS confirmou recebimento e kickoff tem data.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Primeiro contato com lead novo | Até 15 minutos | SDR / Social Setter |
| Qualificação BANT | Na primeira ligação atendida | SDR |
| Sessão estratégica | Até 5 dias úteis após o agendamento | Closer |
| Envio da proposta | Até 24h após a sessão | Closer |
| Follow-up de proposta | Data marcada no CRM, sem exceção | Closer |
| Passagem pro CS | Até 2 dias úteis após assinatura | Closer / CS |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Conversão lead para reunião agendada | Subindo mês a mês | CRM, funil por etapa |
| Conversão reunião para proposta | Acompanhada semanalmente | CRM, funil por etapa |
| Conversão proposta para fechamento | Acompanhada semanalmente | CRM, funil por etapa |
| Vendas do mês | Meta do módulo Metas e KPIs | Etapa Fechado por closed_at |
| Ticket médio | Crescente | Metas e KPIs |

## Erros comuns

- **Registrar venda fora da etapa Fechado.** Consequência: venda não conta nos dashboards nem na meta — pro sistema, ela não existe.
- **Confundir data de criação com data de fechamento.** Consequência: relatório de vendas do mês errado; a data que vale é sempre `closed_at`.
- **Lead qualificado esperando dias pelo primeiro contato.** Consequência: lead quente esfria e a verba de captação vira desperdício.
- **Pular a transcrição na sessão.** Consequência: proposta sem insumo, dossiê vazio e retrabalho manual.
- **Fechar e demorar a passar pro CS.** Consequência: cliente novo no vácuo nos primeiros dias — pior momento possível pra silêncio.

## Checklist rápido

- [ ] Lead novo com nome, WhatsApp e origem no CRM
- [ ] Todo lead com dono e próxima atividade
- [ ] BANT registrado antes de agendar reunião
- [ ] Reunião criada pela integração da Agenda Google
- [ ] Transcrição da sessão salva no lead
- [ ] Proposta conferida antes do envio, com follow-up marcado
- [ ] Contrato assinado antes de mover pra Fechado
- [ ] Venda registrada na etapa Fechado com data de fechamento correta
- [ ] CS avisado e kickoff com data$md$ WHERE slug = 'processo-comercial-ponta-a-ponta';

UPDATE public.staff_processes SET summary = 'Qualificação BANT em 5 etapas no discador, com brief de IA, coach em tempo real e agendamento na hora.', content = $md$## Objetivo

Padronizar a qualificação: todo SDR liga do mesmo jeito, qualifica pelos mesmos critérios e agenda reunião só com quem tem perfil. Quando funciona, a agenda do closer enche de decisor qualificado e a conversão da sessão sobe. Quando falha, o closer perde hora com lead sem verba e sem decisão — e a máquina inteira desacelera.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| SDR | Executar a fila do discador, qualificar com BANT e agendar a sessão na própria ligação |
| Head Comercial | Escutar ligações, calibrar o playbook e cobrar cadência |
| Closer | Receber a reunião com o contexto registrado pelo SDR no lead |

## Quando roda

Gatilho: lead novo no funil ou lead na fila do discador. Frequência: diária — o SDR trabalha a fila do discador todos os dias úteis, priorizando leads recém-chegados (contato em até 15 minutos) e retrabalhando a cadência dos não atendidos. As tarefas "Playbook ·" nos funis SE/SS ditam a sequência: siga a ordem, não pule etapa.

## Fluxo do processo

```mermaid
flowchart TD
    A["Lead entra na fila do discador"] --> B["Ler o brief de IA do lead antes de discar"]
    B --> C["Ligar pelo discador do CRM"]
    C --> D{"Atendeu?"}
    D -->|"não"| E["Registrar tentativa e seguir cadência"]
    E --> C
    D -->|"sim"| F["Etapa 1: abertura com contexto"]
    F --> G["Etapa 2: diagnóstico rápido, 3 perguntas de dor"]
    G --> H["Etapa 3: qualificação BANT"]
    H --> I{"Passou no BANT?"}
    I -->|"não"| J["Descartar com motivo registrado"]
    I -->|"sim"| K["Etapa 4: pitch da sessão estratégica"]
    K --> L["Etapa 5: agendar na hora com convite na ligação"]
    L --> M["Reunião na agenda do closer via Google"]
```

## Passo a passo

1. **Prepare-se antes de discar.** Abra o brief do lead no discador — a IA resume histórico, origem e contexto antes da ligação. Nunca ligue no escuro. Feito quando: você sabe quem é o lead e por que vai ligar pra ELE.
2. **Etapa 1 — Abertura com contexto.** Diga por que está ligando pra essa pessoa especificamente: origem do lead, o que ela preencheu, o que você viu do negócio. Nada de script genérico. Feito quando: o lead entendeu que a ligação é pra ele, não em massa.
3. **Etapa 2 — Diagnóstico rápido.** Três perguntas de dor: bate meta todo mês? Tem previsibilidade de quanto vai vender? Quanto da venda depende do dono? Use o coach de IA em tempo real como apoio — ele sugere a próxima pergunta pela metodologia. Feito quando: pelo menos uma dor concreta apareceu.
4. **Etapa 3 — Qualificação BANT.** Quatro filtros, nessa ordem de peso:
   - **Budget** — a empresa fatura acima de R$50 mil por mês? Tem verba pra investir?
   - **Authority** — estou falando com o dono ou decisor?
   - **Need** — qual a dor? Não bate meta, sem previsibilidade, conversão baixa, dependência do dono.
   - **Timing** — quando quer resolver?
   Registre as respostas na qualificação assistida do discador. Feito quando: os 4 critérios têm resposta registrada.
5. **Etapa 4 — Pitch da sessão estratégica.** Venda a reunião, não o serviço. A sessão é um diagnóstico gratuito do comercial dele — o SDR não fala de preço nem de escopo. Feito quando: o lead entendeu o valor da sessão e topou marcar.
6. **Etapa 5 — Agendamento na hora.** Agende ainda na ligação, com convite disparado na hora pela integração da Agenda Google — a reunião cai direto na agenda do closer, slots de 07h às 23h. Nunca "te mando o link depois". Feito quando: lead confirmou o convite recebido e o lead foi movido de etapa no CRM.
7. **Não passou no BANT?** Descarte com motivo registrado no CRM. Lead descartado com motivo alimenta o funil de nutrição futura; lead descartado sem motivo é dado perdido.
8. **Não atendeu?** Registre a tentativa e siga a cadência: espaçar as tentativas em horários diferentes por vários dias úteis antes de descartar por "não atende". Use as tarefas "Playbook ·" do funil como guia da sequência.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Primeiro contato com lead novo | Até 15 minutos | SDR |
| Cadência completa de tentativas | 5 dias úteis, horários variados | SDR |
| Registro do BANT no CRM | Na própria ligação | SDR |
| Agendamento da sessão | Na própria ligação | SDR |
| Escuta e feedback de ligações | Semanal | Head Comercial |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Ligações por dia | Cadência combinada com o Head | Discador do CRM |
| Taxa de atendimento | Acompanhada por horário | Discador do CRM |
| Conversão ligação atendida para reunião | Subindo mês a mês | CRM, funil por etapa |
| Comparecimento na sessão agendada | Alto — reunião confirmada não é reunião realizada | Agenda e CRM |
| Leads contatados em até 15 minutos | 100 por cento dos leads novos | CRM, tempo de primeira atividade |

## Erros comuns

- **Vender o serviço na ligação.** Consequência: SDR não vende — SDR qualifica e agenda. Falar de preço e escopo mata a sessão e queima o lead.
- **Pular etapa do playbook.** Consequência: BANT incompleto, closer recebendo lead sem verba ou sem decisor. As tarefas "Playbook ·" existem pra isso: siga a sequência.
- **Agendar sem falar com o decisor.** Consequência: sessão com quem não decide é sessão perdida — Authority é filtro, não detalhe.
- **"Te mando o link depois".** Consequência: convite que não sai na ligação tem comparecimento muito menor. Agendamento é na hora.
- **Ligar sem ler o brief.** Consequência: abertura genérica, lead percebe ligação em massa e desliga.
- **Descartar sem motivo registrado.** Consequência: o funil perde inteligência e o lead some sem histórico.

## Checklist rápido

- [ ] Brief de IA lido antes de cada ligação
- [ ] Abertura com contexto: por que estou ligando pra VOCÊ
- [ ] 3 perguntas de dor feitas antes do BANT
- [ ] BANT completo registrado na qualificação assistida
- [ ] Falei com o dono ou decisor, não com intermediário
- [ ] Pitch vendeu a sessão, não o serviço
- [ ] Convite disparado ainda na ligação
- [ ] Lead movido de etapa no CRM na hora
- [ ] Tarefas "Playbook ·" do funil em dia, sem etapa pulada$md$ WHERE slug = 'playbook-sdr';

UPDATE public.staff_processes SET summary = 'A rotina diária do closer: dossiê antes, diagnóstico na reunião, proposta em 24h e follow-up sagrado.', content = $md$## Objetivo

Garantir que nenhuma reunião aconteça sem preparo e nenhuma proposta morra sem follow-up. O closer que segue essa rotina chega na sessão sabendo mais do lead do que ele espera, sai com transcrição que vira proposta e nunca deixa negociação no vácuo. Quando a rotina quebra, reunião vira conversa solta, proposta atrasa e o funil enche de lead "pensando" pra sempre.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Closer | Executar a rotina completa: preparo, condução, proposta, follow-up e fechamento |
| Head Comercial | Revisar pipeline do closer, destravar negociações e auditar a rotina |
| SDR | Entregar o lead com BANT e dor mapeada registrados no CRM |

## Quando roda

Diária, em três blocos: antes da primeira reunião (preparo), durante cada sessão (condução) e após cada sessão (proposta e registro). Gatilho do preparo: agenda do dia no CRM. Gatilho do pós: fim de cada reunião.

## Fluxo do processo

```mermaid
flowchart TD
    A["Conferir agenda do dia no CRM"] --> B["Revisar dossiê do lead: histórico, transcrições, dor do SDR"]
    B --> C["Sessão estratégica no Meet com transcrição ativa"]
    C --> D["Diagnóstico: funil, jornada, gargalos, concorrência"]
    D --> E["Quantificar a dor em dinheiro"]
    E --> F["Salvar e conferir transcrição no lead"]
    F --> G["Gerar proposta na aba Proposta e conferir valor"]
    G --> H["Enviar proposta e marcar follow-up com data"]
    H --> I{"Fechou?"}
    I -->|"sim"| J["Contrato no gerador e lead pra etapa Fechado"]
    I -->|"não"| K{"Ainda negociando?"}
    K -->|"sim"| H
    K -->|"não"| L["Perder com motivo registrado"]
```

## Passo a passo

1. **Confira a agenda do dia.** Primeira coisa da manhã: agenda do dia no CRM. Saiba quantas sessões tem, com quem e em que horário. Feito quando: dia mapeado antes da primeira reunião.
2. **Revise o dossiê de cada lead.** Antes de cada sessão, leia o dossiê: histórico, transcrições anteriores e a dor mapeada pelo SDR. Chegar sem contexto é queimar o trabalho do SDR e a paciência do lead. Feito quando: você sabe a dor declarada e o que já foi conversado.
3. **Conduza a sessão pelo diagnóstico.** No Meet, sempre com transcrição ativa — ela vira insumo da proposta. Roteiro: cenário atual, funil, jornada, gargalos e concorrência. A pergunta central: quanto custa por mês não resolver isso? Reunião sem métrica é terapia em grupo. Feito quando: gargalo identificado e dor quantificada em dinheiro.
4. **Salve e confira a transcrição.** Logo após a reunião, confirme que a transcrição está salva no lead. O fechamento diário roda às 20h e importa as transcrições do Meet, mas não espere por ele pra trabalhar. Feito quando: transcrição visível no lead.
5. **Gere a proposta na aba Proposta.** A IA extrai valor e forma de pagamento da transcrição e monta o PDF. Confira tudo antes de enviar: valor, forma de pagamento, escopo. IA gera, closer valida — proposta errada na rua não tem volta. Feito quando: proposta conferida e enviada em até 24h após a sessão.
6. **Marque o follow-up.** Toda proposta enviada tem próxima atividade com data no CRM. Proposta enviada sem follow-up marcado não existe. Feito quando: atividade futura criada no lead.
7. **Fechou?** Gere o contrato no gerador de contratos, envie pra assinatura e mova o lead pra etapa **Fechado** — a venda conta como won com data `closed_at`. Confirme que você está atribuído à negociação: a venda conta pro vendedor atribuído no momento do fechamento. Feito quando: contrato assinado, lead em Fechado, atribuição correta.
8. **Precisou remarcar?** Use a ação de reagendar — ela move o evento mantendo dono e link. Nunca crie reunião duplicada; cancelamento é exclusão do evento. Feito quando: um único evento na agenda, no horário novo.
9. **Perdeu?** Registre o motivo no CRM antes de marcar como perdido. Lead perdido sem motivo é aprendizado jogado fora.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Revisão de agenda e dossiês | Antes da primeira reunião do dia | Closer |
| Transcrição conferida no lead | No mesmo dia da sessão | Closer |
| Envio da proposta | Até 24h após a sessão | Closer |
| Follow-up de proposta | Data marcada, executada no dia | Closer |
| Contrato após aceite | Mesmo dia do aceite | Closer |
| Revisão de pipeline | Semanal | Head Comercial |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Conversão sessão para proposta | Subindo mês a mês | CRM, funil por etapa |
| Conversão proposta para fechamento | Acompanhada semanalmente | CRM, funil por etapa |
| Propostas enviadas em até 24h | 100 por cento | CRM, data da sessão vs envio |
| Leads sem próxima atividade | Zero | CRM |
| Vendas do mês vs meta | 100 por cento ou mais | Metas e KPIs, ranking diário 20h30 |

## Erros comuns

- **Entrar na reunião sem ler o dossiê.** Consequência: repete perguntas que o SDR já fez, perde autoridade e alonga a venda.
- **Sessão sem transcrição ativa.** Consequência: proposta sem insumo — a IA não tem de onde extrair valor e forma de pagamento, e vira retrabalho manual.
- **Enviar proposta gerada por IA sem conferir.** Consequência: valor ou forma de pagamento errados na rua; contrato e confiança comprometidos.
- **Proposta enviada sem follow-up marcado.** Consequência: negociação morre no vácuo. Proposta sem follow-up não existe.
- **Lead sem próxima atividade agendada.** Consequência: lead perdido — é a regra da casa, sem exceção.
- **Criar reunião nova pra remarcar.** Consequência: evento duplicado, dono errado, link errado e lead confuso. Reagendar move o evento.
- **Fechar e esquecer de mover pra Fechado.** Consequência: venda invisível pra meta, comissão e ranking.

## Checklist rápido

- [ ] Agenda do dia conferida antes da primeira reunião
- [ ] Dossiê lido antes de cada sessão
- [ ] Transcrição ativa em toda reunião do Meet
- [ ] Dor quantificada em dinheiro na sessão
- [ ] Transcrição salva e conferida no lead
- [ ] Proposta gerada na aba Proposta e validada antes do envio
- [ ] Follow-up com data em toda proposta enviada
- [ ] Nenhum lead da carteira sem próxima atividade
- [ ] Fechamento: contrato no gerador e lead na etapa Fechado$md$ WHERE slug = 'rotina-closer';

UPDATE public.staff_processes SET summary = 'Porta de entrada padrão do funil: landing /sessao, contato em 15 minutos, BANT e roteiro de diagnóstico.', content = $md$## Objetivo

Fazer da sessão estratégica uma máquina previsível de oportunidades: lead preenche o formulário, é contatado em minutos, chega qualificado na frente do closer e sai com diagnóstico e próximo passo claro. Quando o processo roda, a captação inteira converge pra um único fluxo mensurável. Quando falha, lead quente esfria na fila e a verba de tráfego vira custo sem retorno.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Marketing | Manter tráfego pago e social apontando pra landing /sessao, com rastreamento |
| SDR | Contato em até 15 minutos, qualificação BANT e agendamento |
| Social Setter | Contato e direcionamento dos leads vindos de social selling |
| Closer | Conduzir a sessão pelo roteiro de diagnóstico e encaminhar proposta |

## Quando roda

Gatilho: lead preenche o formulário da landing **unvholdings.com.br/sessao** — nome e WhatsApp, caindo direto no funil do CRM. Roda continuamente: tráfego pago, social e prospecção ativa apontam todos pra essa página. O relógio do SLA começa no momento do preenchimento.

## Fluxo do processo

```mermaid
flowchart TD
    A["Lead preenche formulário em unvholdings.com.br/sessao"] --> B["Lead cai no funil do CRM com origem registrada"]
    B --> C["Dono definido por round-robin"]
    C --> D["SDR ou Social Setter contata em até 15 minutos"]
    D --> E{"Atendeu?"}
    E -->|"não"| F["Seguir cadência de tentativas"]
    F --> D
    E -->|"sim"| G["Qualificação BANT"]
    G --> H{"Qualificado?"}
    H -->|"não"| I["Descartar com motivo"]
    H -->|"sim"| J["Sessão agendada com o closer via Agenda Google"]
    J --> K["Closer conduz o diagnóstico no Meet"]
    K --> L["Caminho recomendado e próximo passo claro"]
    L --> M["Proposta encaminhada"]
```

## Passo a passo

1. **Captação convergente.** Tráfego pago, social selling e prospecção ativa apontam pra landing /sessao. Campanha nova sem rastreamento de origem não sobe. Feito quando: todo canal ativo direciona pra página e a origem aparece no CRM.
2. **Entrada no funil.** O formulário grava nome e WhatsApp direto no funil do CRM, com dono definido por round-robin. Feito quando: lead visível no funil, com dono.
3. **Contato em até 15 minutos.** SDR ou Social Setter liga assim que o lead cai — lead quente esfria rápido. Cada minuto de espera derruba a taxa de contato. Feito quando: primeira tentativa registrada dentro do SLA.
4. **Qualificação BANT.** Na ligação, aplicar o Playbook do SDR: faturamento acima de R$50 mil por mês, decisor na linha, dor mapeada, prazo pra resolver. Feito quando: BANT registrado e decisão tomada.
5. **Agendamento da sessão.** Convite disparado na própria ligação, pela integração da Agenda Google — cai na agenda do closer, slots de 07h às 23h. Feito quando: lead confirmou o convite.
6. **Confirmação de presença.** Véspera e dia da sessão: confirmar por WhatsApp. No-show sem confirmação prévia é falha do processo, não do lead. Feito quando: lead confirmou presença no dia.
7. **Condução da sessão.** O closer segue o roteiro:
   - **Cenário atual** — faturamento, time, funil, ticket médio, conversão
   - **Gargalo principal** — usar o Raio-X Comercial quando aplicável
   - **Caminho recomendado** — com métrica e prazo
   - **Próximo passo claro** — a sessão nunca termina em "vou pensar" sem data
   Sempre no Meet com transcrição ativa. Feito quando: lead sai com diagnóstico verbalizado e próximo passo agendado.
8. **Encaminhamento.** Proposta gerada e enviada conforme a rotina do closer, em até 24h. Feito quando: proposta na rua com follow-up marcado.
9. **No-show.** Remarcar na hora pelo reagendamento — mover o evento, nunca duplicar. Duas faltas sem justificativa: devolver pro SDR requalificar o timing.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Primeiro contato após o formulário | Até 15 minutos | SDR / Social Setter |
| Cadência de tentativas | 5 dias úteis, horários variados | SDR |
| Sessão realizada | Até 5 dias úteis após o agendamento | Closer |
| Confirmação de presença | Véspera e dia da sessão | SDR |
| Proposta após a sessão | Até 24h | Closer |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Leads contatados em até 15 minutos | 100 por cento | CRM, tempo de primeira atividade |
| Conversão formulário para sessão agendada | Subindo mês a mês | CRM, funil por etapa |
| Comparecimento na sessão | Alto, com dupla confirmação | Agenda e CRM |
| Conversão sessão para proposta | Acompanhada semanalmente | CRM |
| CAC do funil | Dentro do teto definido pelo Marketing | Dashboards de tráfego no CRM |

## Erros comuns

- **Demorar horas pro primeiro contato.** Consequência: taxa de contato despenca e o investimento em tráfego vira desperdício. O SLA de 15 minutos é a regra mais importante do processo.
- **Vender o serviço na ligação de agendamento.** Consequência: a sessão perde o sentido — o SDR vende a reunião, o diagnóstico acontece nela.
- **Sessão sem roteiro.** Consequência: conversa agradável e zero avanço. Cenário, gargalo, caminho, próximo passo — nessa ordem.
- **Terminar a sessão sem próximo passo com data.** Consequência: "vou pensar" eterno; o funil enche de lead morno sem desfecho.
- **Não confirmar presença.** Consequência: no-show alto e agenda do closer queimada.
- **Campanha apontando pra landing sem rastreamento.** Consequência: impossível saber qual canal traz lead que fecha; decisão de verba no escuro.

## Checklist rápido

- [ ] Todos os canais ativos apontando pra /sessao com origem rastreada
- [ ] Lead novo com dono definido por round-robin
- [ ] Primeiro contato em até 15 minutos
- [ ] BANT registrado antes de agendar
- [ ] Convite na agenda do closer disparado na ligação
- [ ] Presença confirmada na véspera e no dia
- [ ] Sessão com transcrição ativa e roteiro completo
- [ ] Lead saiu com próximo passo claro e com data$md$ WHERE slug = 'sessao-estrategica';

UPDATE public.staff_processes SET summary = 'Regras da casa no CRM: todo lead com dono e atividade, etapa na hora, venda só em Fechado, agenda integrada.', content = $md$## Objetivo

Manter o CRM como retrato fiel da operação: se está no CRM, é verdade; se não está no CRM, não aconteceu. Com o CRM limpo, funil, metas, ranking e dashboards de tráfego batem com a realidade e a diretoria decide com número confiável. CRM sujo contamina tudo que depende dele — projeção, comissão, relatório de cliente e a IA que trabalha em cima dos dados.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| SDR / BDR / Social Setter | Cadastro completo do lead, atividades em dia, etapa atualizada na hora |
| Closer | Negociações com próxima atividade, propostas e fechamentos registrados certo |
| Head Comercial | Auditoria semanal de higiene do CRM e configuração dos funis |
| CS | Consulta de histórico na passagem de bastão; nunca apaga registro |

## Quando roda

Contínuo — o CRM é atualizado em tempo real, não no fim do dia. Gatilhos práticos: lead novo (cadastro), qualquer conversa ou avanço (atividade e etapa), reunião (agenda integrada), fechamento (etapa Fechado). Auditoria de higiene: semanal, pelo Head Comercial.

## Fluxo do processo

```mermaid
flowchart TD
    A["Lead novo no CRM"] --> B["Cadastro: nome, WhatsApp e origem obrigatórios"]
    B --> C["Dono definido por round-robin quando configurado no funil"]
    C --> D["Próxima atividade criada com data"]
    D --> E["Interação com o lead"]
    E --> F["Mover etapa na hora, não no fim do dia"]
    F --> G{"Reunião marcada?"}
    G -->|"sim"| H["Criar pela integração da Agenda Google, slots 07h às 23h"]
    G -->|"não"| I["Registrar atividade seguinte com data"]
    H --> I
    I --> J{"Fechou a venda?"}
    J -->|"sim"| K["Mover pra etapa Fechado: venda won com closed_at"]
    J -->|"não"| E
```

## Passo a passo

1. **Cadastre completo.** Nome, WhatsApp e origem são obrigatórios em todo lead. Pra empresa: faturamento e número de vendedores no cadastro — é isso que qualifica o ICP da UNV, 1 ou mais vendedores e faturamento acima de R$50 mil por mês. Feito quando: nenhum campo obrigatório vazio.
2. **Todo lead tem dono.** A distribuição automática por round-robin atribui o dono quando configurada no funil. Lead sem dono é lead de ninguém — e lead de ninguém não é trabalhado. Feito quando: campo de dono preenchido em 100 por cento do funil.
3. **Todo lead tem próxima atividade.** Sempre com data. Encerrou uma atividade, cria a seguinte na hora. Lead sem próxima atividade agendada é lead perdido. Feito quando: nenhum lead ativo sem atividade futura.
4. **Etapa reflete a realidade.** Mover o lead na hora em que o avanço acontece, não no fim do dia. O funil é leitura ao vivo da operação. Feito quando: a etapa de cada lead bate com o status real da conversa.
5. **Reuniões só pela integração.** Toda reunião criada pela integração da Agenda Google — cai na agenda do closer, slots de 07h às 23h. Reagendar é mover o evento: mantém dono e link. Cancelar é excluir o evento. Nunca duplicar. Feito quando: um evento por reunião, sempre pela integração.
6. **Venda só na etapa Fechado.** Venda = negociação "won" na etapa Fechado; a data que vale é a do fechamento, `closed_at`. Registrar venda em qualquer outra etapa é registrar venda que não existe pro sistema. Feito quando: toda venda do mês está em Fechado com data correta.
7. **Ações em massa com critério.** Mover, mudar funil e atribuir em lote é suportado. Automações disparam em lotes de até 50 — em volumes grandes, o processamento respeita esse limite. Feito quando: a ação em massa terminou e uma amostra foi conferida.
8. **Preserve o histórico.** Conversas e transcrições nunca são apagadas — são o insumo do dossiê, da proposta por IA e da auditoria. Feito quando: histórico íntegro em qualquer lead auditado.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Cadastro completo do lead novo | Na criação | SDR / BDR / Social Setter |
| Atualização de etapa | Na hora do avanço | Dono do lead |
| Criação da próxima atividade | Ao encerrar a anterior | Dono do lead |
| Registro da venda em Fechado | No dia do fechamento | Closer |
| Auditoria de higiene do CRM | Semanal | Head Comercial |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Leads sem dono | Zero | CRM, visão do funil |
| Leads sem próxima atividade | Zero | CRM, visão do funil |
| Leads com origem preenchida | 100 por cento | CRM, cadastro |
| Vendas registradas fora de Fechado | Zero | CRM, auditoria semanal |
| Reuniões fora da integração de agenda | Zero | Agenda Google vs CRM |

## Erros comuns

- **Lead parado sem atividade e sem dono.** Consequência: lead morre em silêncio e ninguém percebe — é o erro número 1 da casa.
- **Registrar venda fora da etapa Fechado.** Consequência: a venda não conta em meta, ranking, comissão nem dashboard. Pro sistema, não existiu.
- **Atualizar etapa "depois".** Consequência: funil mentiroso o dia inteiro; qualquer leitura da diretoria sai errada.
- **Criar reunião duplicada ao remarcar.** Consequência: dois eventos, dono e link errados, lead entrando na sala vazia. Reagendar = mover o evento.
- **Marcar reunião fora da integração da agenda.** Consequência: reunião invisível pro CRM — sem transcrição vinculada, sem dossiê, sem métrica.
- **Apagar histórico de conversa ou transcrição.** Consequência: dossiê e proposta por IA perdem insumo; auditoria fica impossível. Proibido, sem exceção.
- **Cadastro sem faturamento e número de vendedores.** Consequência: impossível validar ICP; lead fora do perfil avança no funil e desperdiça sessão.

## Checklist rápido

- [ ] Todo lead novo com nome, WhatsApp e origem
- [ ] Empresa com faturamento e número de vendedores no cadastro
- [ ] Zero leads sem dono no funil
- [ ] Zero leads sem próxima atividade com data
- [ ] Etapas atualizadas na hora, não no fim do dia
- [ ] Reuniões criadas só pela integração da Agenda Google
- [ ] Remarcação sempre pelo reagendar, nunca evento novo
- [ ] Vendas do mês todas em Fechado com closed_at correto
- [ ] Nenhum histórico ou transcrição apagado$md$ WHERE slug = 'uso-do-crm';

UPDATE public.staff_processes SET summary = 'Como metas são definidas no Metas e KPIs, como a venda é atribuída ao vendedor e os rituais de acompanhamento.', content = $md$## Objetivo

Deixar meta e comissão sem zona cinzenta: todo vendedor sabe qual é sua meta, como a venda é atribuída e onde acompanhar o placar todo dia. Quando o processo roda, a projeção da empresa é a soma confiável das metas individuais e a comissão sai sem discussão. Quando falha, vendedor sem meta cadastrada, venda atribuída errado e fim de mês virando negociação de quem vendeu o quê.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Head Comercial | Definir e cadastrar as metas mensais, conduzir a reunião semanal de metas |
| Closer / SDR | Conhecer a própria meta, manter o CRM correto pra atribuição bater |
| Financeiro | Apurar comissão a partir das vendas won em Fechado |
| Master | Validar metas da empresa e acompanhar a projeção do mês |

## Quando roda

- **Mensal**: cadastro das metas por vendedor antes do dia 1 do mês.
- **Diário**: ranking automático no grupo às 20h30.
- **Semanal**: reunião de metas com número na mesa.
- **No fechamento de cada venda**: atribuição registrada no momento em que o lead vai pra etapa Fechado.

## Fluxo do processo

```mermaid
flowchart TD
    A["Head define metas mensais por vendedor"] --> B["Cadastro no módulo Metas e KPIs"]
    B --> C["Projeção da empresa = soma das metas dos vendedores ativos"]
    C --> D["Vendas acontecem: won na etapa Fechado"]
    D --> E["Venda conta pro vendedor atribuído no fechamento"]
    E --> F["Ranking diário automático no grupo às 20h30"]
    F --> G["Reunião semanal de metas com número na mesa"]
    G --> H{"Ritmo bate com a meta?"}
    H -->|"sim"| I["Manter cadência"]
    H -->|"não"| J["Plano de ação: funil, conversão, ticket"]
    J --> G
    I --> K["Fechamento do mês e apuração de comissão"]
```

## Passo a passo

1. **Cadastre as metas mensais.** Metas por vendedor entram no módulo **Metas & KPIs** (kpi_monthly_targets) antes do mês começar. Vendedor sem meta cadastrada fica fora da projeção. Feito quando: todo vendedor ativo tem meta do mês no módulo.
2. **Marque quem é closer de CRM.** Quem aparece nas metas e vendas do CRM é quem está marcado como **closer de CRM** no cadastro do colaborador. Contratou ou desligou vendedor: ajustar a marcação na hora. Feito quando: a lista de vendedores nas metas bate com o time real.
3. **Entenda a projeção.** A projeção do mês da empresa é a soma das metas individuais dos vendedores ativos. Não existe meta da empresa separada das metas do time. Feito quando: projeção do painel confere com a soma das metas cadastradas.
4. **Atribuição da venda.** A venda conta pro vendedor **atribuído** à negociação no momento do fechamento — won na etapa Fechado, data `closed_at`. Antes de mover pra Fechado, confira a atribuição. Feito quando: toda venda do mês tem o vendedor certo.
5. **Vendas importadas não mexem em comissão.** Vendas importadas de histórico não alteram comissão vigente — servem pra análise, não pra apuração. Feito quando: apuração do mês considera só vendas do ciclo corrente.
6. **Acompanhe o ranking diário.** Sai automático no grupo às 20h30, todo dia. É o placar público: quem vendeu, quem está atrás, quanto falta. Feito quando: time inteiro viu o ranking e sabe sua posição.
7. **Reunião semanal de metas.** Sempre com número na mesa: funil, conversão por etapa, ticket médio e projeção. Sem número, não tem reunião — reunião sem métrica é terapia em grupo. Cada desvio sai com plano de ação e responsável. Feito quando: ata com números, decisões e responsáveis.
8. **Fechamento e apuração.** Virou o mês: financeiro apura comissão sobre as vendas won em Fechado com `closed_at` dentro do mês, pela atribuição registrada. Divergência se resolve olhando o CRM — o CRM é a fonte da verdade. Feito quando: comissão apurada e comunicada sem pendência.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Cadastro das metas do mês | Antes do dia 1 | Head Comercial |
| Ajuste de closer de CRM ao entrar/sair vendedor | No dia da mudança | Head Comercial |
| Conferência da atribuição da venda | No fechamento, antes de mover pra Fechado | Closer |
| Ranking diário | Automático, 20h30 | Sistema |
| Reunião semanal de metas | Toda semana, dia fixo | Head Comercial |
| Apuração de comissão | Até o dia 5 do mês seguinte | Financeiro |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Vendedores ativos com meta cadastrada | 100 por cento | Metas e KPIs |
| Atingimento individual | 100 por cento ou mais | Metas e KPIs, ranking 20h30 |
| Projeção do mês vs realizado | Desvio caindo semana a semana | Metas e KPIs |
| Conversão por etapa do funil | Revisada na reunião semanal | CRM |
| Ticket médio | Crescente | Metas e KPIs |
| Divergências de comissão | Zero | Apuração do financeiro vs CRM |

## Erros comuns

- **Mês começar sem meta cadastrada.** Consequência: projeção da empresa errada desde o dia 1 e vendedor sem alvo — quem não tem meta não persegue nada.
- **Vendedor sem a marcação de closer de CRM.** Consequência: vendas dele invisíveis nas metas e no ranking; parece que não vendeu nada.
- **Fechar venda com atribuição errada.** Consequência: comissão do vendedor errado e briga no fim do mês. A atribuição se confere ANTES de mover pra Fechado.
- **Registrar venda fora da etapa Fechado.** Consequência: não conta pra meta nem pra comissão. Venda é won em Fechado, data `closed_at`.
- **Usar venda importada de histórico na apuração.** Consequência: comissão paga em cima de dado retroativo — importação não altera comissão vigente.
- **Reunião de metas sem número.** Consequência: opinião no lugar de dado, plano de ação genérico e desvio se acumulando até estourar no fim do mês.
- **Ignorar o ranking diário.** Consequência: desvio detectado tarde; o ranking existe pra corrigir rota em dia, não em retrospectiva.

## Checklist rápido

- [ ] Metas do mês cadastradas no Metas e KPIs antes do dia 1
- [ ] Todo vendedor ativo marcado como closer de CRM no cadastro
- [ ] Projeção do painel igual à soma das metas individuais
- [ ] Atribuição conferida antes de mover cada venda pra Fechado
- [ ] Venda registrada como won em Fechado com closed_at certo
- [ ] Ranking das 20h30 acompanhado todo dia
- [ ] Reunião semanal com funil, conversão, ticket médio e projeção
- [ ] Comissão apurada só sobre vendas do ciclo, sem importados$md$ WHERE slug = 'metas-e-comissao';

UPDATE public.staff_processes SET summary = 'O padrão de entrega de todo projeto: diagnóstico, plano de 6 meses, vitória rápida, rotina de gestão e treinamento.', content = $md$## Objetivo

Garantir que todo cliente UNV receba o mesmo padrão de entrega, na mesma ordem, independente de qual consultor atende. Cliente renova quando enxerga resultado com processo — e esse processo é o que transforma serviço em produto replicável. Quando ele falha, a entrega vira improviso: cada consultor faz de um jeito, o cliente não vê evolução estruturada e o churn vira questão de tempo. Sistema bem estruturado escala, improviso não escala.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Consultor / CS | Dono da execução dos 5 passos no cliente. Conduz diagnóstico, plano, rotina e treinamento |
| Head Comercial | Valida o plano de 6 meses e acompanha a carteira nos rituais de gestão |
| Diretoria (master) | Patrocina casos críticos e cobra o padrão — nenhum cliente fora do modelo |

## Quando roda

- **Gatilho:** contrato assinado e onboarding concluído (ver processo "Onboarding de cliente novo").
- **Frequência:** o ciclo completo cobre os 6 meses do plano. Passos 1 a 3 acontecem nos primeiros 30-45 dias; passos 4 e 5 são contínuos até a renovação.

## Fluxo do processo

```mermaid
flowchart TD
    A["Contrato assinado e kickoff feito"] --> B["Passo 1: Diagnóstico profundo"]
    B --> C["Passo 2: Plano mínimo de 6 meses"]
    C --> D["Passo 3: Primeira vitória rápida definida com data"]
    D --> E{"Vitória entregue no prazo?"}
    E -->|"sim"| F["Passo 4: Rotina de gestão contínua com métrica"]
    E -->|"não"| G["Replanejar com o cliente e nova data"]
    G --> D
    F --> H["Passo 5: Treinamento contínuo dos vendedores"]
    H --> I{"Semáforo verde e metas evoluindo?"}
    I -->|"sim"| J["Seguir plano até renovação"]
    I -->|"não"| K["Revisar fase do CRESCER e ajustar plano"]
    K --> F
```

## Passo a passo

1. **Diagnóstico profundo.** Levantar funil, jornada do cliente, gargalos e concorrência. Como: formulários de mapeamento, acesso ao CRM do cliente, reunião de imersão com dono e time. Onde: dados registrados no Nexus, no projeto do cliente. Critério de feito: gargalo principal identificado e quantificado em dinheiro, fase do CRESCER definida.
2. **Planejamento mínimo de 6 meses.** Montar plano por fase, com metas e responsáveis nomeados (do lado UNV e do lado do cliente). Como: usar o Método CRESCER como roadmap — o Raio-X Comercial posiciona o cliente nas fases e prioriza. Critério de feito: plano apresentado ao dono, aprovado, com datas.
3. **Primeira vitória rápida.** Escolher uma entrega de impacto visível cedo — o objetivo é gerar confiança enquanto a estruturação profunda faz efeito. ROI visível em 3 a 5 meses. Como: eleger a alavanca mais rápida do diagnóstico (ex.: reativação de base, ajuste de follow-up, correção de funil). Critério de feito: vitória entregue, medida e comunicada ao dono com número.
4. **Rotina de gestão contínua.** Reuniões periódicas com o cliente, sempre com métrica na mesa: ticket médio, conversão, CAC, LTV, NPS. Reunião de gestão sem métrica não conta como entrega — "reunião sem métrica é terapia em grupo". Onde: agenda recorrente + registro no Nexus. Critério de feito: reunião realizada, decisões registradas, KPIs atualizados.
5. **Treinamento contínuo dos vendedores.** Playbook do cliente documentado, role play e acompanhamento do time comercial dele. Como: sessões de treinamento na rotina semanal/quinzenal, escuta de ligações e feedback. Critério de feito: time do cliente executando o playbook sem depender do dono.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Diagnóstico profundo concluído | Até 15 dias do kickoff | Consultor |
| Plano de 6 meses aprovado pelo dono | Até 30 dias do kickoff | Consultor + Head |
| Primeira vitória rápida entregue | Até 45 dias do kickoff | Consultor |
| Rotina de gestão instalada (reunião recorrente) | A partir da semana 2 | Consultor |
| Primeiro ciclo de treinamento do time do cliente | Dentro do primeiro mês | Consultor |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| NPS do cliente | 8+ | Nexus (acompanhamento do projeto) |
| Saúde do cliente | Verde — meta batida em 100% ou mais garante piso 75 | Painel de clientes (/onboarding-tasks) |
| ROI visível pro cliente | Em 3 a 5 meses | Números do projeto vs. baseline do diagnóstico |
| Reuniões de gestão com métrica | 100% das reuniões | Registros no Nexus |

## Erros comuns

- **Pular o diagnóstico e sair executando.** Sem baseline, não existe prova de evolução na renovação — o cliente esquece de onde partiu.
- **Plano de 6 meses genérico, sem responsável e sem data.** Vira documento morto; o cliente sente que está pagando por reunião, não por direção.
- **Adiar a vitória rápida em nome da "estruturação".** O cliente perde a fé antes da estrutura ficar pronta. A vitória rápida compra o tempo da estruturação.
- **Reunião de gestão sem métrica.** Não conta como entrega. Terapia em grupo não renova contrato.
- **Treinar o time do cliente uma vez e parar.** Treinamento é contínuo — sem repetição o playbook morre e a dependência do dono volta.

## Checklist rápido

- [ ] Diagnóstico com gargalo quantificado em dinheiro registrado no Nexus
- [ ] Plano de 6 meses aprovado pelo dono, com metas e responsáveis
- [ ] Vitória rápida definida com data — e entregue no prazo
- [ ] Reunião de gestão recorrente na agenda, sempre com métrica
- [ ] KPIs do cliente (ticket médio, conversão, CAC, LTV, NPS) atualizados
- [ ] Treinamento do time do cliente acontecendo na rotina
- [ ] Semáforo de saúde do cliente conferido na semana
- [ ] Vitórias documentadas ao longo do ciclo, não só no fim$md$ WHERE slug = 'modelo-de-entrega';

UPDATE public.staff_processes SET summary = 'A metodologia proprietária de crescimento comercial em 7 fases, do raio-x do cenário à revisão contínua.', content = $md$## Objetivo

Dar um caminho único e replicável pra levar qualquer cliente do caos comercial ao crescimento com margem. O CRESCER é a espinha dorsal da UNV: estrutura o diagnóstico na venda e vira o roadmap dos 6 meses na entrega. Sem ele, cada consultor inventa um método — e aí não existe padrão, não existe comparação entre clientes e não existe escala.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Closer | Aplica o CRESCER na sessão estratégica pra estruturar o diagnóstico de venda |
| Consultor / CS | Usa o CRESCER como roadmap do plano de 6 meses e reavalia a fase do cliente todo mês |
| Head Comercial | Garante que venda e entrega falam a mesma língua — o diagnóstico da venda vira o ponto de partida da entrega |

## Quando roda

- **Gatilho na venda:** toda sessão estratégica — o diagnóstico segue a estrutura das fases.
- **Gatilho na entrega:** início do projeto (posicionamento do cliente) e revisão mensal do plano.
- **Frequência:** o Raio-X Comercial é aplicado no diagnóstico inicial e reaplicado quando o plano é revisado, pra medir evolução.

## Fluxo do processo

```mermaid
flowchart TD
    A["Fase 1 Cenário: raio-x da operação atual"] --> B["Fase 2 Resultado Ideal: meta quantificada"]
    B --> C["Fase 3 Estrutura: time, papéis, ferramentas, processo"]
    C --> D["Fase 4 Sistema de Captação: demanda previsível"]
    D --> E["Fase 5 Conversão: funil, script, follow-up"]
    E --> F["Fase 6 Escala: volume com margem"]
    F --> G["Fase 7 Revisão: melhoria contínua com métrica"]
    G --> H{"Meta do Resultado Ideal atingida?"}
    H -->|"sim"| I["Novo ciclo: elevar a meta"]
    H -->|"não"| J["Voltar à fase com gargalo apontado pelo Raio-X"]
    J --> C
```

## Passo a passo

1. **Cenário.** Raio-x da operação atual: faturamento, time, funil, ticket médio, conversão, canais. Como: formulários de mapeamento + imersão com dono e time. Onde: registrado no Nexus, no projeto. Critério de feito: fotografia completa da operação, com números.
2. **Resultado Ideal.** Definir onde o cliente quer chegar — meta quantificada, não desejo vago. "Vender mais" não é meta; "aumentar ticket médio de X pra Y em 6 meses" é. Critério de feito: meta numérica com prazo, validada pelo dono.
3. **Estrutura.** Desenhar time, papéis, ferramentas e processo comercial necessários pra meta. Aqui entram contratações, redistribuição de funções e implantação de CRM quando não existe. Critério de feito: organograma comercial definido e processo documentado.
4. **Sistema de Captação.** Instalar canais de geração de demanda previsível — tráfego, prospecção ativa, indicação, social. Critério de feito: pelo menos um canal gerando volume constante e mensurável de leads.
5. **Conversão.** Trabalhar funil, script, follow-up e taxa por etapa. É onde o volume vira venda. Critério de feito: taxa de conversão por etapa medida e melhorando contra o baseline do Cenário.
6. **Escala.** Aumentar volume com margem, sem quebrar a operação. Crescimento que destrói margem não passa no filtro. Critério de feito: volume crescendo com margem preservada e operação estável.
7. **Revisão.** Ciclo de melhoria contínua com métrica: o que funcionou escala, o que não funcionou sai. Critério de feito: rotina mensal de revisão instalada, com decisões registradas.

**Ferramenta de diagnóstico — Raio-X Comercial.** Escore de 0 a 70 que posiciona o cliente nas fases e prioriza o plano. Aplicar no diagnóstico inicial e nas revisões. A fase com pior escore é onde o plano concentra força.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Raio-X Comercial aplicado | No diagnóstico inicial (até 15 dias do kickoff) | Consultor |
| Fases 1 e 2 concluídas (Cenário + Resultado Ideal) | Primeiros 30 dias do projeto | Consultor |
| Cliente posicionado nas 7 fases, com plano priorizado | Junto com o plano de 6 meses | Consultor + Head |
| Reaplicação do Raio-X | Na revisão mensal do plano | Consultor |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Escore do Raio-X Comercial | Evolução a cada reaplicação | Registro no Nexus (projeto do cliente) |
| Meta do Resultado Ideal | Definida por cliente, quantificada | Plano de 6 meses + KPIs no Nexus |
| Clientes com fase CRESCER atualizada | 100% da carteira | Revisão mensal do plano |

## Erros comuns

- **Pular o Cenário e ir direto pra Captação.** Jogar lead em funil quebrado só queima verba — o gargalo quase nunca é falta de lead.
- **Aceitar Resultado Ideal vago.** "Crescer" não orienta plano nenhum. Sem meta quantificada, a fase 7 não tem contra o que revisar.
- **Escalar antes de arrumar Conversão.** Volume em cima de funil furado amplia o prejuízo, não o resultado.
- **Não reaplicar o Raio-X.** Sem novo escore, não existe prova de evolução — e a renovação fica sem case.
- **Usar o CRESCER só na venda e abandonar na entrega.** O método é um só: o diagnóstico da sessão estratégica é o ponto de partida do projeto.

## Checklist rápido

- [ ] Raio-X Comercial aplicado e escore registrado
- [ ] Cliente posicionado nas 7 fases
- [ ] Resultado Ideal quantificado e validado pelo dono
- [ ] Plano de 6 meses priorizado pela fase de pior escore
- [ ] Baseline do Cenário documentado (pra comparar depois)
- [ ] Revisão mensal marcada com reaplicação do Raio-X
- [ ] Evolução de escore comunicada ao cliente com número$md$ WHERE slug = 'metodo-crescer';

UPDATE public.staff_processes SET summary = 'Do contrato assinado ao kickoff: cadastro completo no Nexus, grupo de WhatsApp vinculado e primeiras entregas com data.', content = $md$## Objetivo

Colocar o cliente novo dentro da máquina UNV na primeira semana: cadastro completo no Nexus, grupo de WhatsApp vinculado, kickoff feito e diagnóstico iniciado. Onboarding malfeito é a maior causa de churn precoce — cliente com cadastro incompleto fica "invisível" pros rituais automáticos (resumo diário, relatório de vitória, relatórios do Marcelo) e a percepção de entrega despenca antes do trabalho começar.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Consultor / CS | Dono do onboarding: cadastro, grupo, kickoff, acessos e início do diagnóstico |
| Admin | Apoia cadastro no Nexus e liberação de acessos |
| Closer (transição) | Passa o contexto da venda: dor mapeada, expectativas, o que foi prometido |

## Quando roda

- **Gatilho:** contrato assinado.
- **Frequência:** uma vez por cliente novo. Todo o checklist fecha na semana da assinatura.

## Fluxo do processo

```mermaid
flowchart TD
    A["Contrato assinado"] --> B["Cadastro no Nexus: empresa e projeto"]
    B --> C{"Serviço, valor de contrato e owner_phone preenchidos?"}
    C -->|"não"| D["Completar cadastro antes de seguir"]
    D --> C
    C -->|"sim"| E["Criar grupo de WhatsApp com o cliente"]
    E --> F["Vincular grupo à empresa no sistema"]
    F --> G["Agendar kickoff com dono e time"]
    G --> H["Liberar acessos: CRM, dashboards, formulários"]
    H --> I["Realizar kickoff com pauta padrão"]
    I --> J["Iniciar diagnóstico profundo: fase Cenário"]
    J --> K["Primeira vitória rápida definida com data"]
```

## Passo a passo

1. **Cadastro no Nexus.** Criar empresa + projeto com o serviço correto, valor de contrato e telefone do dono (owner_phone). Onde: Nexus, painel de clientes. Atenção: sem owner_phone o cliente fica fora dos relatórios automáticos de vitória; valor de contrato errado distorce o MRR. Critério de feito: projeto criado com serviço, valor e owner_phone preenchidos.
2. **Grupo de WhatsApp criado e vinculado.** Criar o grupo de gestão com o cliente e vincular à empresa no sistema (grupo de gestão com company_id). Sem esse vínculo o cliente fica fora do resumo diário das 19h30 e dos relatórios do Marcelo. Critério de feito: grupo criado, vínculo com a empresa confirmado no sistema, resumo diário saindo.
3. **Kickoff agendado.** Reunião de abertura com dono + time do cliente, na primeira semana. Como: convite via agenda, presença do dono é obrigatória — sem dono, remarcar. Critério de feito: kickoff realizado com dono presente.
4. **Acessos liberados.** CRM do cliente, dashboards e formulários de mapeamento. Critério de feito: consultor com acesso a tudo que precisa pro diagnóstico.
5. **Kickoff — pauta padrão.** Apresentação do time UNV e canais de comunicação; expectativas e metas dos primeiros 90 dias; cronograma do plano de 6 meses; primeira vitória rápida definida com data. Critério de feito: pauta cumprida e registrada, vitória rápida com data combinada.
6. **Diagnóstico profundo iniciado.** Começar a fase Cenário do CRESCER: formulários enviados, imersão marcada. Critério de feito: coleta de dados em andamento na primeira semana.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Cadastro completo no Nexus | Até 2 dias úteis da assinatura | Consultor + Admin |
| Grupo de WhatsApp criado e vinculado (company_id) | Até 2 dias úteis da assinatura | Consultor |
| Kickoff realizado | Na semana da assinatura | Consultor |
| Acessos liberados | Antes do kickoff | Admin |
| Diagnóstico iniciado (fase Cenário) | Na semana da assinatura | Consultor |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Onboardings completos na semana da assinatura | 100% | Painel de clientes (/onboarding-tasks) |
| Clientes com owner_phone cadastrado | 100% | Cadastro do projeto no Nexus |
| Grupos vinculados à empresa (company_id) | 100% | Sistema — conferir se o resumo diário sai no grupo |
| Kickoff com dono presente | 100% | Registro da reunião |

## Erros comuns

- **Cadastro incompleto no Nexus.** Cliente "invisível" pros rituais automáticos: sem resumo diário, sem relatório de vitória, sem relatórios do Marcelo. O cliente paga e não sente a máquina — churn precoce anunciado.
- **Grupo criado mas não vinculado à empresa.** O grupo existe, mas o sistema não sabe de quem é. Resultado prático igual a não ter grupo.
- **Kickoff atrasado ou sem o dono presente.** Sem o dono, não há alinhamento de expectativa que se sustente. Remarcar é melhor que fazer sem ele.
- **Primeira entrega sem data combinada.** "Em breve" não gera confiança. Vitória rápida sem data é promessa, não plano.
- **Esperar acessos pra começar o diagnóstico.** Formulários de mapeamento podem ir no dia 1 — acessos correm em paralelo.

## Checklist rápido

- [ ] Empresa + projeto criados no Nexus com serviço correto
- [ ] Valor de contrato preenchido (alimenta o MRR)
- [ ] owner_phone do dono cadastrado
- [ ] Grupo de WhatsApp criado e vinculado à empresa (company_id)
- [ ] Resumo diário das 19h30 saindo no grupo (conferir no primeiro dia útil)
- [ ] Kickoff feito na semana da assinatura, com dono presente
- [ ] Metas dos primeiros 90 dias registradas
- [ ] Primeira vitória rápida definida com data
- [ ] Acessos liberados: CRM do cliente, dashboards, formulários
- [ ] Fase Cenário do CRESCER iniciada$md$ WHERE slug = 'onboarding-cliente-novo';

UPDATE public.staff_processes SET summary = 'Rituais diários, semanais e mensais da gestão de carteira: Copiloto, grupos, reunião com métrica e semáforo.', content = $md$## Objetivo

Garantir que cada cliente da carteira sinta gestão ativa toda semana — consultor UNV é diretor comercial do cliente, não suporte. A rotina existe pra que nenhum cliente fique sem resposta, sem reunião com métrica ou fora dos rituais automáticos. Quando ela falha, o cliente esfria em silêncio: o semáforo amarela, o engajamento cai e o pedido de cancelamento chega "do nada" — que de nada não tem nada.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Consultor / CS | Executa a rotina diária, semanal e mensal da própria carteira |
| Head / Diretoria | Acompanha o semáforo da carteira e entra junto nos casos amarelos/vermelhos |

## Quando roda

- **Diário:** dias úteis, começando pelo Copiloto de Resultados às 7h30.
- **Semanal:** reunião de gestão com cada cliente ativo + revisão do semáforo.
- **Mensal:** revisão do plano de 6 meses e atualização de KPIs no Nexus.

## Fluxo do processo

```mermaid
flowchart TD
    A["7h30: Copiloto de Resultados sugere 1 a 3 ações"] --> B{"Ação faz sentido hoje?"}
    B -->|"sim"| C["Executar a ação sugerida"]
    B -->|"não"| D["Justificar por que não executou"]
    C --> E["Responder grupos de clientes ao longo do dia"]
    D --> E
    E --> F["19h30: conferir se o resumo diário saiu no grupo"]
    F --> G["Semanal: reunião de gestão com métrica por cliente"]
    G --> H["Revisar semáforo de saúde da carteira"]
    H --> I{"Cliente amarelo ou vermelho?"}
    I -->|"sim"| J["Agir na semana: reunião extra, revisar plano"]
    I -->|"não"| K["Manter ritmo e documentar vitórias"]
    J --> L["Mensal: revisar plano de 6 meses e atualizar KPIs"]
    K --> L
```

## Passo a passo

**Diário**

1. **Copiloto de Resultados (7h30, dias úteis).** O sistema sugere 1 a 3 ações prioritárias por consultor. Regra: executar ou justificar — ignorar não é opção. Onde: painel do Copiloto. Critério de feito: cada ação do dia executada ou com justificativa registrada.
2. **Responder grupos de clientes.** Nenhuma mensagem de cliente passa do dia sem resposta. Padrão de trabalho: responder em até 2 horas em horário comercial. Critério de feito: zero mensagem de cliente sem resposta ao fim do dia.
3. **Conferir o resumo diário (19h30, seg-sáb).** O resumo de gestão sai automático nos grupos. Conferir se o do seu cliente saiu — se não saiu, o vínculo do grupo com a empresa (company_id) provavelmente está quebrado. Critério de feito: resumo confirmado em todos os grupos da carteira.

**Semanal**

4. **Reunião de gestão com cada cliente ativo.** Sempre com métrica: funil, conversão, ticket médio, CAC quando houver tráfego. Toda reunião termina com decisão e responsável — "reunião sem métrica é terapia em grupo". Critério de feito: reunião realizada, decisões e responsáveis registrados.
5. **Relatório de Vitória (segunda, 8h).** Sai automático pro dono do cliente. Papel do consultor: validar que o cliente tem owner_phone cadastrado — sem ele, o relatório não chega. Critério de feito: 100% da carteira com owner_phone válido.
6. **Revisar o semáforo de saúde.** Olhar a carteira inteira no painel e agir nos amarelos e vermelhos na mesma semana (ver processo "Saúde do cliente — semáforo"). Critério de feito: todo amarelo/vermelho com ação definida e data.

**Mensal**

7. **Revisão do plano de 6 meses.** Reavaliar fase do CRESCER, metas e próximos 30 dias com o cliente. Critério de feito: plano atualizado e validado com o dono.
8. **Registrar evolução no Nexus.** KPIs do cliente atualizados. Sem registro, não existe case de renovação. Critério de feito: KPIs do mês lançados.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Ações do Copiloto executadas ou justificadas | No mesmo dia | Consultor |
| Resposta a mensagem de cliente | Até 2h em horário comercial; nunca passa do dia | Consultor |
| Reunião de gestão por cliente ativo | 1x por semana | Consultor |
| Ação sobre cliente amarelo/vermelho | Na mesma semana | Consultor + Head |
| Revisão do plano + KPIs atualizados | 1x por mês | Consultor |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Ações do Copiloto tratadas (executadas ou justificadas) | 100% | Painel do Copiloto |
| Clientes com reunião semanal com métrica | 100% da carteira ativa | Registros no Nexus |
| Semáforo da carteira | Maioria verde; nenhum vermelho sem plano | Painel de clientes (/onboarding-tasks) |
| NPS da carteira | 8+ | Nexus |

## Erros comuns

- **Ignorar o Copiloto.** As sugestões vêm do cruzamento de dados da carteira — ignorar sem justificar é dirigir sem painel.
- **Deixar mensagem de cliente pro dia seguinte.** Cliente sem resposta se sente sem gestão. É engajamento caindo — e engajamento entra no cálculo da saúde.
- **Fazer reunião de gestão sem número na mesa.** Não conta como entrega. Terapia em grupo não segura contrato.
- **Não conferir se o resumo diário saiu.** Grupo sem vínculo = cliente fora dos rituais automáticos, e ninguém percebe até o cliente reclamar.
- **Só olhar o semáforo quando alguém cobra.** Amarelo tratado na semana é ajuste; amarelo ignorado por um mês é retenção.
- **Pular o registro mensal de KPIs.** Na renovação, quem não registrou evolução negocia no escuro.

## Checklist rápido

- [ ] Copiloto das 7h30 tratado: ações executadas ou justificadas
- [ ] Zero mensagem de cliente sem resposta hoje
- [ ] Resumo diário das 19h30 saiu em todos os grupos da carteira
- [ ] Reunião semanal com métrica feita em cada cliente ativo
- [ ] Toda reunião terminou com decisão e responsável
- [ ] owner_phone validado (Relatório de Vitória chegando no dono)
- [ ] Semáforo revisado; amarelos/vermelhos com ação e data
- [ ] Plano de 6 meses e KPIs do mês atualizados no Nexus$md$ WHERE slug = 'rotina-consultor-cs';

UPDATE public.staff_processes SET summary = 'Como o semáforo verde/amarelo/vermelho é calculado, o que fazer em cada cor e como funciona o radar de churn.', content = $md$## Objetivo

Dar visibilidade diária e objetiva do risco de cada cliente da carteira, antes do pedido de cancelamento chegar. O semáforo transforma sinais dispersos (resultado, engajamento, entrega) em uma cor acionável. Quando o processo falha — score ignorado ou dados de entrada incompletos — o churn vira surpresa, e churn surpresa é churn que já não dava mais pra reverter.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Sistema (automático) | Recalcula o score todo dia de manhã; motor de retenção roda às 7h e alerta os masters |
| Consultor / CS | Revisa o semáforo da própria carteira toda semana e age nos amarelos/vermelhos |
| Head / Diretoria (master) | Recebe o alerta diário do radar de churn no WhatsApp e patrocina os casos vermelhos |

## Quando roda

- **Cálculo do score:** automático, todo dia de manhã.
- **Radar de churn:** motor de retenção roda diariamente às 7h e alerta os masters no WhatsApp com o top de risco.
- **Revisão humana:** semanal pelo consultor (rotina de carteira); imediata quando a cor piora.

## Fluxo do processo

```mermaid
flowchart TD
    A["Todo dia de manhã: sistema recalcula o score"] --> B["Cruza resultado, engajamento e entrega"]
    B --> C{"Meta batida em 100% ou mais?"}
    C -->|"sim"| D["Piso 75: cliente verde"]
    C -->|"não"| E["Score composto define a cor"]
    D --> F["7h: motor de retenção alerta masters no WhatsApp"]
    E --> F
    F --> G{"Qual a cor do cliente?"}
    G -->|"verde"| H["Manter ritmo, usar em case, pedir indicação"]
    G -->|"amarelo"| I["Agir na semana: reunião extra, revisar plano"]
    G -->|"vermelho"| J["Tratamento de risco: consultor mais gestão"]
    J --> K["Plano de recuperação com data e diretoria avisada"]
    I --> L{"Amarelo ou vermelho recorrente?"}
    K --> L
    L -->|"sim"| M["Entra no playbook de retenção"]
```

## Passo a passo

1. **Entender o cálculo.** O sistema cruza três dimensões, com resultado mandando mais: **Resultado** (meta do cliente — meta batida em 100% ou mais garante piso 75, verde), **Engajamento** (presença e resposta no WhatsApp + participação nas reuniões) e **Entrega** (tarefas e ações do projeto em dia). Onde: painel de clientes (/onboarding-tasks). Critério de feito: consultor sabe explicar por que o cliente está na cor que está.
2. **Garantir dados de entrada.** O score só funciona com cadastro completo: grupo de WhatsApp vinculado à empresa (alimenta engajamento), metas cadastradas (alimenta resultado) e tarefas do projeto no Nexus (alimenta entrega). Critério de feito: nenhuma dimensão do cliente calculando no vazio.
3. **Cliente verde — manter e alavancar.** Manter ritmo de gestão; usar nos cases e pedir indicação. Verde é momento de colher prova social, não de relaxar. Critério de feito: case documentado ou indicação pedida no ciclo.
4. **Cliente amarelo — agir na semana.** Reunião extra, revisar plano, entender a queda de engajamento. Amarelo é aviso barato: tratado cedo, é ajuste de rota. Critério de feito: ação executada na mesma semana, com registro.
5. **Cliente vermelho — tratamento de risco.** Consultor + gestão juntos, plano de recuperação com data e diretoria avisada. Vermelho não é problema do consultor sozinho. Critério de feito: plano de recuperação escrito, com data e patrocinador da gestão.
6. **Acompanhar o radar de churn.** O motor de retenção roda às 7h e alerta os masters no WhatsApp com o top de risco. Amarelo/vermelho recorrente entra no playbook de retenção (ver processo próprio). Critério de feito: todo cliente do alerta com responsável e próximo passo.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Recálculo do score | Diário, de manhã (automático) | Sistema |
| Alerta do radar de churn aos masters | Diário, 7h (automático) | Sistema |
| Ação sobre cliente amarelo | Na mesma semana | Consultor |
| Plano de recuperação de cliente vermelho | Até 2 dias úteis da virada de cor | Consultor + Gestão |
| Revisão do semáforo da carteira | Semanal | Consultor |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Distribuição de cores da carteira | Maioria verde; vermelho sempre com plano ativo | Painel de clientes (/onboarding-tasks) |
| Tempo de reação ao amarelo | Ação na mesma semana | Registros no Nexus |
| Clientes do radar de churn com responsável definido | 100% | Alerta diário + acompanhamento da gestão |
| NPS | 8+ | Nexus |

## Erros comuns

- **Tratar o semáforo como enfeite do painel.** Score que ninguém olha não previne nada. A cor existe pra disparar ação, não pra decorar dashboard.
- **Cliente com cadastro incompleto.** Grupo sem vínculo ou meta sem cadastro faz o score calcular errado — cliente parece pior (ou melhor) do que é, e a ação vai pro lugar errado.
- **Comemorar verde e sumir.** Verde é o melhor momento pra documentar case e pedir indicação. Deixar pra pedir quando precisar é pedir tarde.
- **Empurrar amarelo com a barriga.** Amarelo recorrente é vermelho em formação. O custo de agir na semana é uma reunião; o custo de esperar é o contrato.
- **Consultor segurando vermelho sozinho.** Vermelho sem diretoria avisada quebra a regra do processo e queima a chance de retenção com patrocínio.

## Checklist rápido

- [ ] Semáforo da carteira revisado na semana
- [ ] Sei explicar a cor de cada cliente (resultado, engajamento, entrega)
- [ ] Dados de entrada completos: grupo vinculado, metas e tarefas no Nexus
- [ ] Amarelos com ação executada na mesma semana
- [ ] Vermelhos com plano de recuperação, data e diretoria avisada
- [ ] Alerta das 7h do radar de churn conferido (masters)
- [ ] Verdes aproveitados: case documentado ou indicação pedida
- [ ] Amarelo/vermelho recorrente encaminhado pro playbook de retenção$md$ WHERE slug = 'saude-do-cliente';

UPDATE public.staff_processes SET summary = 'Como responder a um pedido de cancelamento: diagnóstico do motivo real antes de qualquer resposta — números, não súplica.', content = $md$## Objetivo

Transformar pedido de cancelamento em decisão informada — do cliente e nossa. A maioria dos cancelamentos é por caixa do cliente, não insatisfação com a entrega, e os dois casos têm tratamentos completamente diferentes. Quando esse processo falha, a resposta vira aceite automático ou desconto em pânico: perde-se receita que dava pra manter e, pior, perde-se a informação do porquê — que é o que alimenta o radar de churn.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Consultor / CS | Primeira linha: recebe o pedido, levanta o motivo real e monta os números do projeto |
| Master / Diretoria | Participa da reunião de retenção nos casos relevantes; patrocina plano de correção quando é insatisfação |
| Admin | Apoia na formalização do desfecho (pausa, redução, cancelamento) |
| Financeiro | Executa o desfecho: suspende régua e recorrência quando o churn é confirmado |

## Quando roda

- **Gatilho:** qualquer pedido ou sinalização de cancelamento — formal ou "estamos repensando".
- **Frequência:** sob demanda. Também é acionado preventivamente quando amarelo/vermelho recorrente entra no playbook via radar de churn.

## Fluxo do processo

```mermaid
flowchart TD
    A["Pedido de cancelamento chega"] --> B["Não aceitar nem dar desconto de imediato"]
    B --> C["Conversa pra entender o motivo real"]
    C --> D["Levantar números: ROI, leads, vendas, evolução"]
    D --> E["Montar diagnóstico de retenção em PDF curto"]
    E --> F["Reunião de retenção com o dono"]
    F --> G{"Motivo é caixa ou insatisfação?"}
    G -->|"caixa"| H["Mostrar custo de desligar a máquina"]
    H --> I["Propor degrau menor ou pausa com data de retomada"]
    G -->|"insatisfação"| J["Assumir e corrigir: plano de 30 dias com diretoria"]
    I --> K{"Cliente aceita alternativa?"}
    J --> K
    K -->|"sim"| L["Formalizar acordo e registrar no Nexus"]
    K -->|"não"| M["Registrar churn_date e comunicar financeiro"]
```

## Passo a passo

1. **Segurar a primeira resposta.** Regra número 1: pedido de cancelamento não se responde com aceite nem com desconto. Se responde com diagnóstico. Responder o cliente no mesmo dia, agradecendo a franqueza e marcando conversa. Critério de feito: conversa marcada sem nenhuma concessão feita.
2. **Entender o motivo real.** Na conversa, separar o que é caixa do cliente do que é insatisfação com a entrega. Na maioria dos casos é caixa — mas assumir isso sem perguntar é erro. Critério de feito: motivo real identificado e registrado.
3. **Levantar os números do projeto.** ROI entregue, leads gerados, vendas atribuídas, evolução vs. início. Onde: Nexus (KPIs do projeto), CRM do cliente, dashboards de tráfego. Critério de feito: números consolidados e conferidos.
4. **Montar o diagnóstico de retenção.** PDF curto: o que foi entregue, o que muda se cancelar, alternativas. Objetivo é o dono decidir olhando pra fatos. Critério de feito: PDF pronto antes da reunião.
5. **Reunião de retenção com o dono.** Apresentar números, não súplica. Alternativas na mesa: redução de escopo temporária, pausa negociada com data de retorno, renegociação de fluxo. Critério de feito: reunião feita com o dono, decisão encaminhada.
6. **Se for caixa (o caso mais comum).** Mostrar o custo de desligar a máquina — ex.: reduzir tráfego = menos leads = menos caixa, a espiral que aperta ainda mais o caixa. Propor degrau menor em vez de desligamento total. Registrar data de retomada combinada. Critério de feito: alternativa proposta com números e data de retomada registrada.
7. **Se for insatisfação.** Assumir, sem defesa corporativa. Corrigir rota com plano de 30 dias e patrocínio da diretoria. Critério de feito: plano de 30 dias escrito, com responsável da diretoria.
8. **Registrar sempre.** Motivo e desfecho no Nexus — alimenta o radar de churn e melhora a prevenção. Critério de feito: registro completo, qualquer que seja o desfecho.
9. **Se o cancelamento for confirmado.** Registrar churn_date no projeto e comunicar o financeiro (suspende régua e recorrência). Sair bem: cliente que sai respeitado volta e indica. Critério de feito: churn_date registrado, financeiro comunicado, régua suspensa.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Primeira resposta ao cliente (sem aceite, sem desconto) | Mesmo dia | Consultor |
| Motivo real + números do projeto levantados | Até 2 dias úteis | Consultor |
| Diagnóstico de retenção (PDF) pronto | Antes da reunião | Consultor |
| Reunião de retenção com o dono | Até 5 dias úteis do pedido | Consultor + Master |
| Registro de motivo e desfecho no Nexus | No dia da decisão | Consultor |
| churn_date + comunicação ao financeiro (se confirmar) | No dia da confirmação | Consultor + Financeiro |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Taxa de reversão de pedidos de cancelamento | Acompanhar e melhorar ciclo a ciclo | Registros de retenção no Nexus |
| Pedidos com motivo real registrado | 100% | Nexus (alimenta o radar de churn) |
| Clientes em pausa com data de retomada registrada | 100% | Nexus |
| Churn | Reduzir — meta da diretoria | Painel MRR / projetos com churn_date |

## Erros comuns

- **Aceitar o cancelamento na primeira mensagem.** Some a chance de reter e some a informação do motivo. Nunca.
- **Oferecer desconto antes de diagnosticar.** Se o problema é caixa, desconto só adia; se é insatisfação, desconto ofende. Nos dois casos, destrói margem sem resolver.
- **Tratar caixa como insatisfação (e vice-versa).** São tratamentos diferentes. Errar o diagnóstico é aplicar o remédio errado.
- **Ir pra reunião de retenção sem números.** Vira súplica. Números do próprio cliente são o único argumento que sustenta.
- **Não registrar motivo e desfecho no Nexus.** O radar de churn aprende com esses registros — pular o registro condena a carteira a repetir o erro.
- **Confirmar churn e esquecer o financeiro.** Régua de cobrança rodando em cliente cancelado é o jeito mais rápido de queimar uma futura retomada.

## Checklist rápido

- [ ] Primeira resposta no mesmo dia, sem aceite e sem desconto
- [ ] Motivo real identificado: caixa ou insatisfação
- [ ] ROI, leads, vendas e evolução vs. início levantados
- [ ] Diagnóstico de retenção (PDF curto) pronto antes da reunião
- [ ] Reunião de retenção feita com o dono, com números na mesa
- [ ] Alternativas oferecidas: redução de escopo, pausa com data, renegociação de fluxo
- [ ] Se caixa: custo de desligar a máquina mostrado e degrau menor proposto
- [ ] Se insatisfação: plano de 30 dias com patrocínio da diretoria
- [ ] Motivo e desfecho registrados no Nexus
- [ ] Se confirmado: churn_date registrado e financeiro comunicado$md$ WHERE slug = 'retencao-e-cancelamento';

UPDATE public.staff_processes SET summary = 'Renovação começa 60 dias antes do fim: case com números do próprio cliente, proposta em D-30 e escalada em D-15.', content = $md$## Objetivo

Fazer a renovação ser consequência natural de um ciclo bem entregue — não uma negociação de última hora. Renovação começa 60 dias antes do fim do contrato, com case montado sobre os números do próprio cliente. Quando o processo falha, a conversa acontece em cima do vencimento, sem prova de evolução na mão, e a renovação vira queda de braço por preço.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Consultor / CS | Dono da renovação: prepara o case, conduz a reunião de resultados e formaliza a proposta |
| Financeiro | Confere condições do contrato vigente e prepara a cobrança do novo ciclo |
| Master / Diretoria | Entra quando não há resposta em D-15 ou quando a negociação exige alçada |

## Quando roda

- **Gatilho:** D-60 do fim do contrato — sem exceção.
- **Frequência:** contínua na carteira; o painel de Renovações em /onboarding-tasks mostra os vencimentos que estão chegando.

## Fluxo do processo

```mermaid
flowchart TD
    A["Painel de Renovações: contrato entra em D-60"] --> B["D-60: revisar resultados do ciclo"]
    B --> C["Preparar case de renovação com números do cliente"]
    C --> D["D-45: reunião de resultados com o dono"]
    D --> E["Mostrar evolução vs. baseline e plano do próximo ciclo"]
    E --> F["D-30: formalizar proposta de renovação"]
    F --> G["Gerar contrato novo no gerador de contratos"]
    G --> H{"Cliente respondeu até D-15?"}
    H -->|"sim"| I["Assinatura e novo ciclo registrado no Nexus"]
    H -->|"não"| J["Escalar pra diretoria"]
    J --> K{"Renovou?"}
    K -->|"sim"| I
    K -->|"não"| L["Tratar como retenção: playbook de cancelamento"]
```

## Passo a passo

1. **Monitorar o painel de Renovações.** Onde: /onboarding-tasks (Renovações) — renovações e vencimentos ficam ali. Cliente sem movimentação no painel é risco silencioso. Critério de feito: nenhum contrato da carteira entra em D-60 sem o consultor saber.
2. **D-60 — revisar o ciclo e montar o case.** Consultor revisa resultados do ciclo e prepara o case de renovação com os números do próprio cliente: evolução vs. baseline do diagnóstico, vitórias documentadas, KPIs. Como: puxar registros do Nexus — por isso o registro mensal de KPIs é inegociável. Critério de feito: case pronto, com números conferidos.
3. **D-45 — reunião de resultados com o dono.** Mostrar evolução vs. baseline e apresentar o plano do próximo ciclo (novas metas, próxima fase do CRESCER). A conversa é sobre o futuro, ancorada no que já foi provado. Critério de feito: reunião feita com o dono, plano do próximo ciclo apresentado.
4. **D-30 — formalizar a proposta.** Proposta de renovação formalizada com contrato novo no gerador de contratos. Valores conforme catálogo vigente (aba Produtos & Valores do manual — nunca valor decorado). Critério de feito: contrato novo enviado pro cliente.
5. **D-15 — escalar se não houver resposta.** Sem resposta = escalar pra diretoria. Não deixar o contrato vencer em silêncio. Critério de feito: diretoria acionada e conduzindo a conversa.
6. **Fechar e registrar.** Assinatura do novo ciclo, registro atualizado no Nexus (novo período, valor de contrato correto — alimenta o MRR). Se o cliente decidir não renovar, tratar pelo playbook de retenção e cancelamento. Critério de feito: novo ciclo registrado ou desfecho encaminhado pro playbook de retenção.

**O que sustenta a renovação (construído o ano inteiro, não em D-60):**
- Rotina de gestão cumprida — reuniões com métrica, relatórios entregues
- Vitórias documentadas ao longo do ciclo, não só no fim
- NPS acompanhado (alvo 8+); detrator tratado na hora, não na renovação

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Case de renovação pronto | D-60 | Consultor |
| Reunião de resultados com o dono | D-45 | Consultor |
| Proposta formalizada (contrato no gerador) | D-30 | Consultor |
| Escalada pra diretoria se sem resposta | D-15 | Consultor + Master |
| Registro do novo ciclo no Nexus | Na assinatura | Consultor + Financeiro |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Taxa de renovação | Crescente ciclo a ciclo | Painel de Renovações (/onboarding-tasks) |
| Renovações iniciadas em D-60 | 100% | Painel de Renovações |
| NPS na renovação | 8+ | Nexus |
| Contratos vencidos sem tratativa | Zero | Painel de Renovações |

## Erros comuns

- **Começar a renovação no mês do vencimento.** Sem tempo pra case, reunião e proposta, a conversa vira "renova ou não renova?" — e preço vira o único assunto.
- **Ir pra reunião de resultados sem baseline.** Se a evolução não foi registrada ao longo do ciclo, não há o que mostrar. O case se constrói o ano inteiro.
- **Deixar detrator de NPS pra resolver na renovação.** Detrator se trata na hora que aparece. Na renovação já é tarde — a decisão dele já está tomada.
- **Ignorar cliente parado no painel de Renovações.** Cliente sem movimentação lá é risco silencioso: quando ninguém puxa a conversa, o vencimento decide sozinho.
- **Deixar D-15 passar sem escalar.** Orgulho de resolver sozinho não paga contrato. Escalada em D-15 é regra, não derrota.
- **Renovar e esquecer o cadastro.** Valor de contrato desatualizado no Nexus distorce o MRR e bagunça o financeiro.

## Checklist rápido

- [ ] Painel de Renovações conferido — nenhum contrato entrando em D-60 sem plano
- [ ] Case de renovação pronto em D-60, com números do próprio cliente
- [ ] Evolução vs. baseline documentada (KPIs registrados no ciclo)
- [ ] Reunião de resultados com o dono feita em D-45
- [ ] Plano do próximo ciclo apresentado junto com os resultados
- [ ] Proposta formalizada em D-30 no gerador de contratos
- [ ] Sem resposta em D-15: diretoria escalada
- [ ] NPS 8+ acompanhado; detratores tratados na hora
- [ ] Novo ciclo registrado no Nexus com valor de contrato correto$md$ WHERE slug = 'renovacao-de-contrato';

UPDATE public.staff_processes SET summary = 'Faturas em company_invoices via Asaas, baixa automática pelo webhook e régua de WhatsApp que respeita o Jurídico.', content = $md$## Objetivo

Garantir que todo cliente ativo seja cobrado no dia certo, pelo canal certo, sem constrangimento desnecessário e sem trabalho manual. Cobrança bem feita protege o caixa e a relação com o cliente ao mesmo tempo. Se esse processo falha, o resultado é inadimplência silenciosa, caixa apertado e cliente cobrado errado — três coisas que custam caro.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Financeiro | Monitorar parcelas e inadimplência diariamente, tratar divergências Asaas x fatura, escalar casos críticos |
| Admin | Configurar régua de lembretes, manter recorrências e cadastros de cobrança corretos |
| Master | Decidir escalada pro Jurídico, aprovar renegociações fora do padrão |
| CS / Consultor | Sinalizar retenção em andamento antes de qualquer escalada de cobrança |
| Sistema (automático) | Gerar faturas das recorrências, dar baixa via webhook Asaas, disparar régua de WhatsApp |

## Quando roda

- **Geração de faturas**: automática, a partir das recorrências cadastradas em cada empresa — sem digitação manual de fatura recorrente.
- **Baixa**: automática, no momento em que o pagamento cai no Asaas (webhook).
- **Régua de WhatsApp**: automática, conforme a configuração de lembretes (antes e depois do vencimento).
- **Monitoramento humano**: todo dia útil, de manhã, pelo financeiro.

## Fluxo do processo

```mermaid
flowchart TD
    A["Recorrência ativa do cliente"] --> B["Sistema gera a fatura em company_invoices"]
    B --> C["Régua de WhatsApp dispara lembretes"]
    C --> D{"Cliente está no Jurídico?"}
    D -->|"sim"| E["Régua suspensa automaticamente"]
    D -->|"não"| F{"Pagamento caiu no Asaas?"}
    F -->|"sim"| G["Webhook dá baixa automática — fatura paga"]
    F -->|"não"| H["Fatura vence — entra no monitor de inadimplência"]
    H --> I{"Atraso de 30 dias ou mais?"}
    I -->|"não"| C
    I -->|"sim"| J["Alinhar com CS antes de escalar"]
    J --> K["Escalada: renegociação ou Jurídico"]
    G --> L["Trava: fatura paga nunca volta pra vencida"]
```

## Passo a passo

1. **Conferir o monitor de parcelas e inadimplência.** Todo dia útil, de manhã, no módulo Financeiro do Nexus. O que olhar: faturas vencendo hoje, vencidas ontem e o acumulado de atraso. Feito quando: nenhuma fatura vencida sem status conhecido (pagou, vai pagar, precisa de ação).
2. **Validar as baixas automáticas.** O webhook do Asaas dá baixa quando o pagamento cai — não dar baixa na mão em fatura de cliente. Se uma fatura paga aparece como pendente, o problema é de sincronização, não de lançamento. Feito quando: pagamentos do dia anterior batem com as faturas quitadas.
3. **Tratar divergência Asaas x fatura pelo caminho certo.** Divergência de saldo ou ajuste do Asaas se resolve **apenas** pelas ações "Excluir ajuste" e "Distribuir ajuste" nas Contas a Receber. Nunca editar saldo na mão — isso quebra a conciliação e esconde o erro em vez de resolver. Feito quando: nenhum ajuste pendente sem tratamento e saldo batendo.
4. **Confirmar que a régua está rodando pra quem deve rodar.** A régua de WhatsApp cobra automaticamente. Regra inviolável: **cliente encaminhado pro Jurídico tem a régua suspensa automaticamente** — quem está em tratativa jurídica não recebe cobrança por mensagem. Conferir que a suspensão está ativa em todo caso escalado. Feito quando: nenhum cliente do Jurídico recebendo mensagem de cobrança.
5. **Cruzar inadimplência com o CS antes de apertar.** Inadimplente com 30+ dias: antes de escalar, falar com o consultor da conta. Pode ser um caso de retenção em andamento — cobrar duro no meio de uma negociação de permanência derruba as duas frentes. Feito quando: cada caso de 30+ dias tem alinhamento registrado com o CS.
6. **Escalar com critério.** Depois do alinhamento com CS: renegociação de fluxo (financeiro conduz) ou encaminhamento pro Jurídico (decisão do master). Ao escalar pro Jurídico, verificar a suspensão da régua (passo 4). Feito quando: caso escalado tem responsável, próximo passo e data.
7. **Registrar tudo no sistema.** Acordos, promessas de pagamento e renegociações ficam registrados na fatura/empresa no Nexus — não em conversa avulsa. O que não está no sistema não existe. Feito quando: qualquer pessoa do time consegue entender o status do caso sem perguntar.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Conferência do monitor de inadimplência | Diária (dia útil, até 10h) | Financeiro |
| Tratamento de divergência Asaas x fatura | Mesmo dia da identificação | Financeiro |
| Resposta a cliente que contesta cobrança | Até 4h úteis | Financeiro |
| Alinhamento com CS (atraso 30+ dias) | Até 2 dias úteis após completar 30 dias | Financeiro |
| Decisão de escalada (renegociar ou Jurídico) | Até 5 dias úteis após alinhamento com CS | Master |
| Verificação da suspensão da régua ao escalar | No ato da escalada | Financeiro |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Inadimplência (% do faturado no mês) | Abaixo de 5% | Monitor de parcelas — módulo Financeiro |
| Faturas vencidas sem status/ação | Zero | Monitor de parcelas |
| Divergências Asaas pendentes | Zero ao fim do dia | Contas a Receber |
| Baixa automática funcionando (pagos x quitados) | 100% de aderência | Financeiro x painel Asaas |
| Casos 30+ dias sem alinhamento com CS | Zero | Monitor de inadimplência |

## Erros comuns

- **Editar saldo do Asaas na mão.** Quebra a conciliação e esconde o erro. Sempre pelas ações "Excluir ajuste" / "Distribuir ajuste".
- **Dar baixa manual em fatura de cliente.** A baixa é do webhook. Baixa manual duplica ou mascara pagamento e distorce a inadimplência real.
- **Reabrir fatura paga.** Não existe: fatura marcada como paga nunca volta pra vencida/pendente — a trava é do sistema. Se parece que precisa, o problema está em outro lugar.
- **Cobrar por WhatsApp cliente que está no Jurídico.** Além de errado, atrapalha a tratativa jurídica. A suspensão é automática — não burlar por canal paralelo.
- **Escalar inadimplente de 30+ dias sem falar com o CS.** Pode detonar uma retenção em andamento e transformar atraso em churn.
- **Confundir company_invoices com o contas a receber interno.** São coisas diferentes: cobrança de cliente roda nas faturas de empresa geradas das recorrências.
- **Acordo fechado só na conversa, sem registro.** Sem registro no Nexus, o acordo morre quando a pessoa esquece ou sai de férias.

## Checklist rápido

- [ ] Monitor de parcelas e inadimplência conferido hoje
- [ ] Pagamentos do Asaas de ontem batem com as faturas quitadas
- [ ] Nenhuma divergência Asaas pendente (ajustes tratados por "Excluir" / "Distribuir")
- [ ] Nenhuma baixa manual em fatura de cliente
- [ ] Clientes no Jurídico com régua de WhatsApp suspensa
- [ ] Casos 30+ dias alinhados com o CS antes de qualquer escalada
- [ ] Acordos e promessas de pagamento registrados no sistema
- [ ] Escaladas com responsável, próximo passo e data$md$ WHERE slug = 'cobranca-e-regua';

UPDATE public.staff_processes SET summary = 'O que entra e o que fica fora do MRR: só contrato mensal ativo, cartão parcelado fora, churn pelo churn_date.', content = $md$## Objetivo

Garantir que o MRR da UNV seja um número confiável — a métrica que a diretoria usa pra medir previsibilidade de receita e tomar decisão. MRR inflado por receita pontual ou distorcido por cadastro errado leva a decisão errada: contratar na hora errada, escalar custo sem lastro, comemorar crescimento que não existe. Previsibilidade é o coração do modelo UNV; esse número tem que ser sagrado.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Financeiro | Conferir contract_value no onboarding de cada cliente novo, auditar o painel de MRR |
| Master | Acompanhar o MRR no painel, questionar variações, usar o número na decisão |
| Admin | Corrigir cadastros de projeto (valor, tipo de contrato, churn_date) quando houver erro |
| CS / Consultor | Registrar churn_date no projeto quando cancelamento for confirmado |

## Quando roda

- **Cálculo**: contínuo — o painel reflete os contratos mensais ativos no momento da consulta.
- **Conferência de cadastro**: a cada cliente novo, na semana do onboarding.
- **Auditoria do painel**: mensal, dentro do fechamento (até o dia 5).
- **Registro de churn**: no dia em que o cancelamento é confirmado.

## Fluxo do processo

```mermaid
flowchart TD
    A["Contrato fechado"] --> B{"Contrato mensal recorrente?"}
    B -->|"sim"| C["Entra no MRR pelo contract_value do projeto"]
    B -->|"não - cartão parcelado 6 ou 12x"| D["Fica fora do MRR — receita pontual"]
    C --> E["Financeiro confere contract_value no onboarding"]
    E --> F{"Valor confere com o contrato assinado?"}
    F -->|"não"| G["Corrigir cadastro do projeto antes de seguir"]
    F -->|"sim"| H["Painel MRR do Mês reflete o contrato"]
    G --> H
    H --> I{"Cliente cancelou?"}
    I -->|"sim"| J["Registrar churn_date no projeto"]
    J --> K["Contrato sai do MRR na data do churn"]
    I -->|"não"| H
```

## Passo a passo

1. **Classificar o contrato na entrada.** Todo contrato novo é classificado: mensal recorrente entra no MRR; cartão parcelado em 6 ou 12 vezes fica fora — é receita pontual, tratada assim no planejamento. Onde: cadastro do projeto no Nexus, na semana da assinatura. Feito quando: o tipo de contrato está claro no cadastro e ninguém precisa adivinhar.
2. **Conferir o contract_value contra o contrato assinado.** O MRR é o somatório dos contract_value dos projetos mensais ativos. Valor errado no cadastro distorce o número inteiro. Onde: cadastro do projeto, comparado com o contrato no gerador de contratos. Feito quando: contract_value bate com o documento assinado, centavo por centavo.
3. **Respeitar a convenção monetária do sistema.** Nos campos do sistema, apenas os que têm sufixo `_cents` estão em centavos; o resto é valor em reais. Errar essa convenção ao cadastrar ou consultar multiplica ou divide o MRR por 100. Feito quando: o valor lançado está na unidade certa do campo.
4. **Acompanhar no painel oficial.** O número que vale é o do painel **MRR do Mês** em /onboarding-tasks/mrr (acesso master). Não usar planilha paralela, print antigo nem conta de cabeça — um número, uma fonte. Feito quando: qualquer discussão de MRR na diretoria parte do painel.
5. **Registrar churn no lugar certo.** Cancelamento confirmado = registrar **churn_date no projeto**. É essa data que tira o contrato do MRR — não a última fatura, não a data da conversa, não a saída do grupo de WhatsApp. Onde: cadastro do projeto no Nexus. Feito quando: churn_date preenchido no dia da confirmação.
6. **Auditar no fechamento mensal.** Uma vez por mês, dentro do fechamento (até o dia 5): varrer os projetos ativos, conferir se algum parcelado entrou indevidamente no MRR, se algum churn ficou sem churn_date e se os contract_value dos novos batem com contrato. Feito quando: a variação de MRR do mês está explicada linha a linha — entradas, saídas e ajustes.
7. **Explicar variação antes de reportar.** MRR subiu ou caiu: saber por quê antes de levar pra diretoria. Novo contrato, churn, correção de cadastro — cada variação tem nome e sobrenome. Feito quando: o reporte do mês traz o número e a decomposição da variação.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Classificação do contrato (mensal x parcelado) | Na semana da assinatura | Financeiro |
| Conferência do contract_value do cliente novo | Na semana do onboarding | Financeiro |
| Registro do churn_date | No dia da confirmação do cancelamento | CS / Consultor |
| Correção de cadastro com valor errado | Até 1 dia útil após identificação | Admin |
| Auditoria do painel de MRR | Mensal, até o dia 5 | Financeiro |
| Reporte de variação do MRR à diretoria | Junto do fechamento mensal | Financeiro |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| MRR do mês | Crescimento mês a mês com variação explicada | Painel MRR do Mês — /onboarding-tasks/mrr |
| Projetos com contract_value divergente do contrato | Zero | Auditoria mensal x gerador de contratos |
| Cancelamentos sem churn_date registrado | Zero | Auditoria mensal dos projetos |
| Contratos parcelados dentro do MRR (indevido) | Zero | Auditoria mensal |
| Prazo de registro do churn_date | Mesmo dia da confirmação | Cadastro do projeto |

## Erros comuns

- **Somar cartão parcelado (6/12x) no MRR.** É receita pontual. Inflar o MRR com ela cria uma previsibilidade que não existe — e a conta chega quando as parcelas acabam.
- **Cadastrar contract_value diferente do contrato assinado.** Um cadastro errado distorce o painel inteiro e mina a confiança no número.
- **Errar a convenção de centavos.** Só campos `_cents` são centavos. Valor em reais lançado como centavos (ou o contrário) gera MRR 100x errado.
- **Deixar cancelamento sem churn_date.** O cliente saiu, mas o MRR continua contando o contrato. O número fica mentindo até alguém perceber.
- **Usar planilha paralela como fonte.** O painel é a fonte única. Duas fontes = dois números = zero confiança.
- **Reportar variação sem decomposição.** "Caiu 8%" sem dizer quem entrou e quem saiu não é reporte, é chute com porcentagem.

## Checklist rápido

- [ ] Contrato novo classificado: mensal (entra) ou parcelado 6/12x (fora)
- [ ] contract_value confere com o contrato assinado
- [ ] Valores lançados na unidade certa (só `_cents` é centavo)
- [ ] Cancelamentos do mês com churn_date registrado no projeto
- [ ] Nenhum parcelado contando no painel de MRR
- [ ] Painel /onboarding-tasks/mrr é a única fonte usada
- [ ] Variação do MRR do mês explicada linha a linha
- [ ] Auditoria mensal feita dentro do fechamento (até o dia 5)$md$ WHERE slug = 'regra-de-mrr';

UPDATE public.staff_processes SET summary = 'Fechamento mensal até o dia 5: conciliação, categorização 100%, DRE/DFC, orçado x realizado e projeção de caixa.', content = $md$## Objetivo

Fechar o mês com número confiável até o dia 5: DRE e DFC prontos, 100% dos lançamentos categorizados, orçado x realizado revisado e projeção de caixa atualizada. É esse fechamento que permite à diretoria decidir com margem no radar — crescimento sem margem não passa no filtro de decisão. Fechamento atrasado ou malfeito significa dirigir a empresa olhando pelo retrovisor embaçado: decisão de contratação, investimento e tráfego sem base real.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Financeiro | Executar o fechamento: conciliar, categorizar, fechar DRE/DFC, montar orçado x realizado e projeção |
| Master | Receber o reporte de desvios, decidir correções de rota, acompanhar caixa e dívida de tráfego |
| Admin | Manter plano de contas, recorrências e cadastros que alimentam o módulo Financeiro |

## Quando roda

- **Fechamento mensal**: do dia 1 ao dia 5 de cada mês, referente ao mês anterior. Dia 5 é teto, não meta.
- **Visibilidade de caixa e dívida de tráfego**: semanal, pra diretoria — ponto de atenção permanente, não espera o fechamento.
- **Rotina de lançamentos**: diária/semanal, pra não acumular categorização pro fim do mês.

## Fluxo do processo

```mermaid
flowchart TD
    A["Vira o mês — dia 1"] --> B["Conciliar Asaas x faturas x extrato"]
    B --> C{"Tudo bate?"}
    C -->|"não"| D["Tratar divergências antes de seguir"]
    D --> B
    C -->|"sim"| E["Categorizar 100% dos lançamentos do mês anterior"]
    E --> F["Fechar DRE e DFC no módulo Financeiro"]
    F --> G["Revisar orçado x realizado por categoria"]
    G --> H{"Desvio relevante em alguma categoria?"}
    H -->|"sim"| I["Reportar desvios à diretoria com causa e ação"]
    H -->|"não"| J["Atualizar projeção de caixa do trimestre"]
    I --> J
    J --> K["Fechamento entregue até o dia 5"]
```

## Passo a passo

1. **Conciliar Asaas x faturas x extrato.** Primeiro passo, sempre. Cruzar o que o Asaas diz que recebeu, o que as faturas dizem que foi quitado e o que caiu no banco. Onde: módulo Financeiro do Nexus (contas a receber, bancos) x painel Asaas x extrato bancário. Divergência de ajuste do Asaas se trata pelas ações "Excluir ajuste" / "Distribuir ajuste" — nunca editando saldo na mão. Feito quando: as três pontas batem, sem pendência.
2. **Categorizar 100% dos lançamentos do mês anterior.** Todo lançamento de contas a pagar e a receber com categoria do plano de contas. Atenção: o **plano de contas vivo são as categorias do módulo staff** — as usadas nos lançamentos do dia a dia. Onde: contas a pagar/receber no módulo Financeiro. Feito quando: zero lançamento sem categoria no mês fechado. 99% não é 100%.
3. **Fechar DRE e DFC do mês.** Com conciliação e categorização prontas, fechar DRE e DFC no módulo Financeiro. Ler o resultado antes de publicar: receita, custos, margem — o número faz sentido contra o que aconteceu no mês? Feito quando: DRE e DFC fechados e revisados, sem "depois eu ajusto".
4. **Revisar orçado x realizado por categoria.** Na aba **Planejamento**: comparar o orçado de cada categoria com o realizado (que puxa das contas a pagar). Identificar as categorias que estouraram e as que sobraram. Feito quando: cada desvio relevante tem causa identificada — não só o número da diferença.
5. **Reportar desvios à diretoria.** Levar os desvios com três coisas: o número, a causa e a ação proposta. Margem antes de receita — desvio que come margem tem prioridade sobre qualquer outro. Feito quando: diretoria recebeu o reporte e as ações têm dono e data.
6. **Atualizar a projeção de caixa do trimestre.** Com o mês fechado, atualizar a projeção: recebimentos previstos, compromissos, folga ou aperto. Dívida de tráfego entra explicitamente na projeção. Feito quando: projeção do trimestre atualizada e o cenário (folga/aperto) está claro.
7. **Manter visibilidade semanal de caixa e dívida de tráfego.** Fora do ciclo mensal: caixa e dívida de tráfego são pontos de atenção permanentes, com visibilidade semanal pra diretoria. Não é opcional e não espera o dia 5. Feito quando: a diretoria sabe, toda semana, a posição de caixa e o saldo da dívida de tráfego.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Conciliação Asaas x faturas x extrato | Até o dia 2 | Financeiro |
| Categorização 100% dos lançamentos | Até o dia 3 | Financeiro |
| DRE e DFC fechados | Até o dia 4 | Financeiro |
| Orçado x realizado + reporte de desvios | Até o dia 5 | Financeiro |
| Projeção de caixa do trimestre atualizada | Até o dia 5 | Financeiro |
| Visibilidade de caixa e dívida de tráfego | Semanal | Financeiro |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Data de entrega do fechamento | Até o dia 5, todo mês | Calendário do financeiro |
| Lançamentos sem categoria no mês fechado | Zero | Contas a pagar/receber — módulo Financeiro |
| Divergências de conciliação pendentes | Zero no fechamento | Conciliação Asaas x faturas x extrato |
| Desvios orçado x realizado sem causa identificada | Zero | Aba Planejamento |
| Margem do mês | Conforme orçamento — margem antes de receita | DRE |
| Reporte semanal de caixa e dívida de tráfego | 100% das semanas | Reporte à diretoria |

## Erros comuns

- **Fechar sem conciliar primeiro.** DRE em cima de dado não conciliado é ficção com formatação bonita. Conciliação vem antes de tudo.
- **Deixar lançamento sem categoria "pra depois".** O orçado x realizado fica cego na categoria errada e o desvio real some do mapa.
- **Usar o plano de contas errado.** O plano vivo são as categorias do módulo staff, usadas nos lançamentos do dia a dia. Orçar numa estrutura e lançar em outra inutiliza a comparação.
- **Editar saldo na mão pra "fechar a conta".** Divergência se trata pelas ações de ajuste ("Excluir" / "Distribuir"), nunca maquiando saldo. Saldo maquiado é bomba com timer.
- **Reportar desvio sem causa nem ação.** Número solto não gera decisão. Desvio se reporta com causa e proposta.
- **Celebrar receita ignorando margem.** Crescimento sem margem não passa no filtro de decisão da UNV. O fechamento existe pra mostrar margem, não só faturamento.
- **Deixar caixa e dívida de tráfego pra reunião mensal.** São pontos de atenção permanentes — visibilidade é semanal.

## Checklist rápido

- [ ] Conciliação Asaas x faturas x extrato batendo, sem pendência
- [ ] Ajustes tratados só por "Excluir ajuste" / "Distribuir ajuste"
- [ ] 100% dos lançamentos do mês anterior categorizados
- [ ] Categorias lançadas no plano de contas vivo (módulo staff)
- [ ] DRE e DFC fechados e revisados
- [ ] Orçado x realizado revisado, desvios com causa e ação
- [ ] Desvios reportados à diretoria
- [ ] Projeção de caixa do trimestre atualizada
- [ ] Reporte semanal de caixa e dívida de tráfego em dia
- [ ] Tudo entregue até o dia 5$md$ WHERE slug = 'financeiro-fechamento';

UPDATE public.staff_processes SET summary = 'Tráfego como máquina de previsibilidade: CAC máximo antes de escalar, rastreio obrigatório e venda por closed_at.', content = $md$## Objetivo

Fazer do tráfego pago uma máquina de previsibilidade — interno e de clientes — onde cada real investido tem CAC conhecido e teto definido. Tráfego sem tripwire vira aposta; aposta não escala e come margem. Se esse processo falha, o dinheiro queima em campanha sem rastreio, o CAC estoura sem ninguém perceber e o cliente recebe relatório de métrica de vaidade em vez de resultado.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Marketing | Operar campanhas, definir rastreamento, monitorar CAC diário, pausar e revisar quando estoura o teto |
| Head Comercial | Validar qualidade dos leads com o time de vendas, fechar o loop funil x campanha |
| Master | Aprovar CAC máximo (tripwire) de cada funil e decisões de escala de verba |
| Sistema (automático) | Integrar leads do Meta no CRM, consolidar dashboards de tráfego, enviar relatórios diários de cliente |

## Quando roda

- **Monitoramento de CAC e volume**: diário, pra toda campanha ativa.
- **Definição de tripwire**: antes de qualquer funil novo escalar — nunca depois.
- **Revisão de campanha**: imediata quando o CAC estoura o teto por dias seguidos ou o volume de leads cai de repente.
- **Relatórios de cliente**: diários por WhatsApp, quando configurado (padrão Clínica Main).

## Fluxo do processo

```mermaid
flowchart TD
    A["Funil novo ou campanha nova"] --> B["Definir CAC máximo do funil — tripwire"]
    B --> C["Configurar rastreamento: UTM e origem no CRM"]
    C --> D{"Rastreio de ponta a ponta funcionando?"}
    D -->|"não"| E["Não escala — corrigir rastreio primeiro"]
    E --> C
    D -->|"sim"| F["Rodar campanha — leads do Meta caem no CRM via integração"]
    F --> G["Monitorar CAC e volume no dashboard diariamente"]
    G --> H{"CAC estourou o teto por X dias seguidos?"}
    H -->|"sim"| I["Pausar e revisar criativo, página e oferta"]
    I --> F
    H -->|"não"| J{"Volume de leads caiu de repente?"}
    J -->|"sim"| K["Conferir sincronização da integração Meta"]
    K --> F
    J -->|"não"| L["Escalar verba com CAC dentro do teto"]
```

## Passo a passo

1. **Definir o CAC máximo antes de escalar.** Todo funil tem tripwire: o CAC teto definido e aprovado antes de colocar verba de escala (ex.: UNV Start opera com CAC máximo de R$30). Sem tripwire, não existe critério pra saber se a campanha está boa ou queimando dinheiro. Feito quando: o teto está documentado e aprovado pelo master.
2. **Montar o rastreamento de ponta a ponta.** Campanha nova nasce com UTM em todos os links e origem configurada no CRM. Regra da casa: **campanha sem rastreio não escala** — sem saber de onde veio o lead, não existe CAC real. Onde: gerenciador de anúncios (UTMs) + configuração de origem no CRM. Feito quando: um lead de teste percorre o caminho e chega no CRM com origem correta.
3. **Validar a integração de leads.** Leads do Meta caem no CRM via integração — conferir que estão entrando no funil certo, com dono e origem. Feito quando: lead gerado no anúncio aparece no CRM em minutos, no funil esperado.
4. **Monitorar CAC e volume todo dia.** Nos dashboards de tráfego do CRM: leads e vendas por funil. Regra de atribuição inegociável: **venda atribuída pela data de fechamento (closed_at), só na etapa Fechado** — não pela data de criação do lead. Feito quando: CAC do dia calculado e comparado com o teto de cada funil ativo.
5. **Agir no tripwire, não na esperança.** CAC estourou o teto por X dias seguidos: pausa e revisão de criativo, página e oferta — **não "mais verba"**. Verba em cima de campanha estourada só escala o prejuízo. Feito quando: campanha pausada, hipótese de causa definida e teste de correção no ar.
6. **Investigar queda súbita de volume.** Volume de leads caiu de repente: primeira suspeita é a sincronização da integração Meta, antes de mexer em campanha. Feito quando: causa identificada — integração ou performance — e tratada no lugar certo.
7. **Reportar pro cliente a métrica que move o negócio dele.** Relatórios automáticos diários por WhatsApp quando configurado (padrão Clínica Main). A métrica reportada é a que move o negócio do cliente — conversa iniciada, agendamento — nunca impressão ou clique. Feito quando: o relatório do cliente sai no horário e fala de resultado, não de vaidade.
8. **Fechar o loop com o comercial.** CAC bom com lead ruim é ilusão. Validar com SDR/closer a qualidade dos leads por campanha e realimentar segmentação e criativo. Feito quando: o marketing sabe quais campanhas geram lead que vira reunião e venda — não só lead que vira linha no CRM.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Definição do tripwire de funil novo | Antes de escalar verba — sem exceção | Marketing + Master |
| Validação de rastreio de campanha nova | Antes de ativar a campanha | Marketing |
| Monitoramento de CAC e volume | Diário | Marketing |
| Pausa e revisão após estouro do teto | No dia da constatação | Marketing |
| Investigação de queda súbita de leads | Até 4h úteis | Marketing |
| Relatório diário de cliente configurado | Todo dia, no horário combinado | Sistema (conferido pelo Marketing) |
| Loop de qualidade de lead com comercial | Semanal | Marketing + Head Comercial |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| CAC por funil | Dentro do teto (tripwire) do funil | Dashboards de tráfego no CRM |
| Campanhas ativas sem UTM/rastreio | Zero | Auditoria de campanhas x origem no CRM |
| Leads por funil (volume diário) | Conforme meta do funil, sem queda súbita | Dashboards de tráfego no CRM |
| Vendas atribuídas a tráfego | Por closed_at, etapa Fechado | Dashboards de tráfego no CRM |
| Conversão lead → reunião por campanha | Crescente por ciclo de otimização | CRM + loop com comercial |
| Relatórios diários de cliente entregues | 100% dos dias | WhatsApp do cliente |

## Erros comuns

- **Escalar verba sem tripwire definido.** Sem teto de CAC, não existe critério — só torcida. É a diferença entre máquina e aposta.
- **Responder CAC estourado com mais verba.** Verba não conserta criativo ruim, página fraca ou oferta errada. Só escala o prejuízo.
- **Ativar campanha sem UTM.** Lead sem origem = CAC de mentira = decisão no escuro. Campanha sem rastreio não escala, ponto.
- **Atribuir venda pela data de criação do lead.** A regra é closed_at, só etapa Fechado. Atribuição errada faz campanha ruim parecer boa (e vice-versa).
- **Ignorar queda súbita de volume achando que "o mercado esfriou".** Na maioria das vezes é a sincronização da integração Meta. Conferir a integração antes de mexer na campanha.
- **Reportar impressão e clique pro cliente.** Métrica de vaidade não paga boleto. Reportar a métrica que move o negócio: conversa iniciada, agendamento.
- **Nunca conversar com o comercial sobre qualidade do lead.** CAC baixo com lead que não vira reunião é dinheiro queimado com aparência de eficiência.

## Checklist rápido

- [ ] Todo funil ativo tem CAC máximo (tripwire) documentado e aprovado
- [ ] Toda campanha ativa tem UTM e origem configurada no CRM
- [ ] Leads do Meta caindo no CRM via integração, no funil certo
- [ ] CAC do dia conferido contra o teto de cada funil
- [ ] Nenhuma campanha estourada recebendo verba extra
- [ ] Queda súbita de leads investigada começando pela integração
- [ ] Vendas atribuídas por closed_at, só etapa Fechado
- [ ] Relatórios diários de clientes saindo no horário
- [ ] Loop semanal de qualidade de lead com o comercial feito$md$ WHERE slug = 'trafego-pago';

UPDATE public.staff_processes SET summary = 'Padrão de conteúdo UNV: vídeo lo-fi, tom direto sem emoji, identidade navy/vermelho e social selling pra sessão.', content = $md$## Objetivo

Garantir que tudo que a UNV publica — vídeo, post, mensagem, arte — tenha a mesma cara e a mesma voz: direto, humano, com autoridade que vem da clareza, não da produção. Conteúdo é máquina de demanda: alimenta o social selling e empurra gente qualificada pra sessão estratégica. Se esse processo falha, a marca vira ruído — cada peça com um tom, vídeo superproduzido que não converte e social parado sem gerar reunião.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Marketing | Planejar pauta, produzir e publicar conteúdo, garantir padrão visual e de tom, acompanhar métricas |
| Social Setter | Atuar no Instagram com abordagem consultiva, transformar interação em sessão estratégica agendada |
| Master | Gravar os vídeos principais e validar posicionamento de mensagens novas de marca |

## Quando roda

- **Produção e publicação**: contínua, conforme calendário de conteúdo semanal.
- **Social selling**: diário — o Social Setter trabalha interações e conversas todo dia útil.
- **Revisão de padrão (tom + identidade visual)**: antes de toda publicação, sem exceção.
- **Leitura de métricas de Instagram**: semanal, via integração no sistema.

## Fluxo do processo

```mermaid
flowchart TD
    A["Pauta definida no calendário"] --> B{"Formato da peça?"}
    B -->|"vídeo"| C["Gravar em lo-fi: câmera estática, fundo real, fala direta"]
    B -->|"arte ou post"| D["Aplicar identidade visual da marca certa"]
    C --> E["Revisão de padrão: tom, formato, identidade"]
    D --> E
    E --> F{"Passou no padrão UNV?"}
    F -->|"não"| G["Corrigir antes de publicar"]
    G --> E
    F -->|"sim"| H["Publicar nos canais"]
    H --> I["Social Setter trabalha as interações no Instagram"]
    I --> J["Abordagem consultiva direciona pra sessão estratégica"]
    J --> K["Métricas acompanhadas via integração no sistema"]
```

## Passo a passo

1. **Definir a pauta da semana.** Calendário simples: temas ligados às dores do ICP (meta não batida, falta de previsibilidade, conversão baixa, dependência do dono) e às mensagens de marca. Feito quando: a semana tem pauta fechada antes de começar — conteúdo não se decide na hora de postar.
2. **Gravar vídeo no padrão lo-fi.** O formato da casa: **câmera estática, fundo real, fala direta. Sem música, sem corte rápido, sem vinheta.** Autoridade vem da clareza, não da produção. Fundo real = ambiente de verdade, não cenário montado. Feito quando: o vídeo cumpre os cinco critérios do formato — qualquer um violado, regrava ou corta o excesso.
3. **Escrever no tom de voz da marca.** Direto, humano, sem parecer robô. **Sem emojis em contexto operacional.** Uma mensagem = uma intenção — se o texto quer dizer duas coisas, são dois conteúdos. Frases de marca que funcionam e podem ser usadas: "reunião sem métrica é terapia em grupo", "vendedor que só bate meta quando o dono entra é figurante". Feito quando: lendo em voz alta, soa como gente falando — não como release.
4. **Aplicar a identidade visual certa.** **UNV**: navy #0D2B5E, vermelho #CC1B1B, branco/cinza claro. **Mansão Empreendedora**: dark luxury — preto #0A0A0A, dourado #C9A84C, creme #E8D5A3. As duas identidades não se misturam na mesma peça. Feito quando: as cores da arte batem com os códigos da marca correspondente.
5. **Revisar antes de publicar.** Checagem rápida de toda peça: formato certo, tom certo, identidade certa, uma intenção só. Peça que não passa, volta — não publica "pra não perder o dia". Feito quando: a peça passou na revisão de padrão.
6. **Trabalhar o social selling em cima do conteúdo.** O Social Setter atua no Instagram: responde interações, abre conversa com **abordagem consultiva** — entende o contexto de quem interagiu antes de oferecer qualquer coisa — e direciona pra **sessão estratégica**. Não é panfletagem de link; é conversa que qualifica. Feito quando: interações relevantes do dia viraram conversa aberta ou sessão agendada.
7. **Acompanhar métricas e realimentar a pauta.** Métricas de Instagram disponíveis via integração no sistema. Ler semanalmente: o que gerou conversa e sessão pauta mais conteúdo do mesmo tipo; o que só gerou curtida sem conversa perde espaço. Feito quando: a pauta da semana seguinte reflete o que os números mostraram.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Pauta da semana fechada | Até sexta da semana anterior | Marketing |
| Revisão de padrão da peça | Antes de toda publicação | Marketing |
| Resposta a interação relevante no Instagram | Mesmo dia útil | Social Setter |
| Direcionamento de conversa qualificada pra sessão | Na própria conversa | Social Setter |
| Leitura de métricas de Instagram | Semanal | Marketing |
| Ajuste de pauta com base nas métricas | Na pauta da semana seguinte | Marketing |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Cadência de publicação | 100% do calendário semanal cumprido | Calendário de conteúdo |
| Peças publicadas fora do padrão (tom/visual/formato) | Zero | Revisão de padrão |
| Conversas abertas pelo Social Setter | Crescente semana a semana | Instagram + CRM |
| Sessões estratégicas originadas do social | Crescente — métrica principal do social selling | CRM (origem do lead) |
| Métricas de Instagram (alcance, interação) | Leitura semanal com ação na pauta | Integração no sistema |

## Erros comuns

- **Superproduzir o vídeo.** Música, corte rápido e vinheta violam o formato lo-fi da casa. A autoridade da UNV vem da clareza da fala, não do efeito.
- **Usar emoji em contexto operacional.** Não é o tom da marca. Mensagem da UNV é direta e humana sem precisar de carinha.
- **Enfiar duas intenções na mesma peça.** Uma mensagem = uma intenção. Peça que vende, ensina e convida ao mesmo tempo não faz nenhuma das três.
- **Misturar as identidades visuais.** Dourado da Mansão em arte da UNV (ou navy da UNV em peça dark luxury) quebra as duas marcas.
- **Social Setter panfletando link.** Mandar link de sessão sem conversa consultiva antes queima a audiência e não agenda nada. Primeiro entende, depois direciona.
- **Publicar sem revisão "pra não furar o calendário".** Peça fora do padrão custa mais caro que um dia sem post.
- **Ignorar as métricas e repetir pauta por hábito.** Conteúdo que não gera conversa nem sessão é esforço decorativo — os números existem pra mudar a pauta.

## Checklist rápido

- [ ] Pauta da semana fechada antes da semana começar
- [ ] Vídeos no padrão lo-fi: câmera estática, fundo real, fala direta, sem música/corte/vinheta
- [ ] Textos sem emoji e com uma intenção por mensagem
- [ ] Cores da peça batendo com a identidade certa (UNV ou Mansão)
- [ ] Toda peça revisada antes de publicar
- [ ] Interações relevantes do Instagram respondidas no dia
- [ ] Conversas qualificadas direcionadas pra sessão estratégica
- [ ] Métricas de Instagram lidas na semana e refletidas na próxima pauta$md$ WHERE slug = 'conteudo-e-social';

UPDATE public.staff_processes SET summary = 'Da vaga à contratação pelo UNV Profile: triagem com DISC, duas entrevistas e contrato gerado no sistema.', content = $md$## Objetivo

Garantir que toda contratação da UNV siga o mesmo funil: vaga estruturada, triagem objetiva e decisão baseada em perfil e histórico — não em feeling. Contratar errado custa caro duas vezes: no salário jogado fora e no cliente mal atendido enquanto o cargo estava com a pessoa errada. Processo bem feito aqui é a primeira linha de defesa do NPS.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| RH | Abre a vaga no UNV Profile, roda a triagem, conduz a entrevista de fit cultural e mantém o banco de talentos vivo |
| Gestor da área | Define requisitos da vaga, conduz a entrevista técnica e dá o veredito final junto com o RH |
| Admin/Master | Aprova a abertura da vaga, valida a proposta e assina o contrato |

## Quando roda

Gatilho: necessidade de contratação aprovada pela diretoria (vaga nova ou reposição). Antes de abrir vaga nova, a primeira fonte de busca é sempre o **banco de talentos** — se tem candidato bom guardado, o processo começa direto na entrevista. Frequência: sob demanda; a vaga fica aberta até fechar ou ser cancelada.

## Fluxo do processo

```mermaid
flowchart TD
    A["Necessidade de contratação aprovada"] --> B{"Tem candidato no banco de talentos?"}
    B -->|"sim"| F["Chamar direto pra entrevista"]
    B -->|"não"| C["Abrir vaga no UNV Profile"]
    C --> D["Divulgar link público da vaga"]
    D --> E["Candidatos aplicam sem login"]
    E --> G["Triagem: currículo + DISC"]
    F --> H["Entrevista RH: fit cultural"]
    G --> H
    H -->|"aprovado"| I["Entrevista técnica com gestor"]
    H -->|"reprovado"| K["Banco de talentos ou descarte"]
    I -->|"aprovado"| J["Proposta + contrato de colaborador"]
    I -->|"reprovado"| K
    J --> L["Contratado: inicia onboarding"]
```

## Passo a passo

1. **Validar a necessidade.** Antes de abrir vaga, a contratação passa pelo filtro de decisão da diretoria (reduz dependência? aumenta capacidade com margem?). Sem aprovação, não existe vaga. Feito = contratação aprovada por master/admin.
2. **Buscar no banco de talentos.** No UNV Profile, varrer os candidatos guardados de processos anteriores com o perfil da vaga. O banco é a primeira fonte, sempre — é mais rápido e mais barato que captar do zero. Feito = busca registrada; se achou candidato viável, pular pro passo 6.
3. **Abrir a vaga no UNV Profile.** Em /onboarding-tasks/vagas, criar a vaga com: descrição do cargo, requisitos objetivos e perfil comportamental esperado. Vaga vaga atrai candidato vago — escrever o que a pessoa vai FAZER e qual resultado se espera dela. Feito = vaga publicada no sistema.
4. **Divulgar o link público.** Todo candidato aplica pelo link público da vaga, **sem precisar de login**. Divulgar nos canais da UNV (redes, indicações do time, grupos do setor). Currículo por WhatsApp ou e-mail não entra no processo — redirecionar pro link. Feito = link circulando e candidaturas caindo no Profile.
5. **Triagem.** Avaliar currículo contra os requisitos e aplicar **DISC quando aplicável** (obrigatório pra cargos comerciais e de gestão). Cortar quem não tem o mínimo antes de gastar hora de entrevista. Feito = shortlist de candidatos aprovados na triagem.
6. **Entrevista de fit cultural (RH).** Avaliar contra o perfil que a UNV contrata: orientado a resultado e métrica (pergunta "quanto", não só "o quê"), execução acima de teoria, baixa necessidade de supervisão. Pra comercial: histórico de meta batida **comprovável** — pedir números, período e como comprova. Quem não fala em número não passa. Feito = parecer registrado no candidato.
7. **Entrevista técnica (gestor da área).** Gestor testa o domínio real do cargo: role play pra comercial, caso prático pra CS, análise real pra financeiro/marketing. Feito = parecer do gestor registrado.
8. **Proposta e contrato.** Aprovado nas duas etapas: formalizar proposta (cargo, remuneração, data de início) e gerar o **contrato de colaborador no gerador de contratos** (/contratos/colaboradores). Feito = contrato assinado.
9. **Alimentar o banco de talentos.** Candidato bom que não foi contratado (segunda opção, perfil pra outra vaga) vai pro banco de talentos com anotação do parecer. Feito = candidato marcado no Profile. Nunca descartar candidato bom em silêncio.
10. **Acionar o onboarding.** Contrato assinado dispara o processo de onboarding de colaborador (ver processo próprio). Feito = data de início confirmada e RH avisado.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Abertura da vaga após aprovação | 2 dias úteis | RH |
| Triagem de cada candidatura | Até 3 dias úteis após aplicar | RH |
| Entrevista RH após triagem aprovada | Até 5 dias úteis | RH |
| Entrevista técnica após fit aprovado | Até 5 dias úteis | Gestor da área |
| Proposta após aprovação final | 2 dias úteis | RH + Admin |
| Ciclo completo (vaga aberta a contrato) | 30 dias | RH |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Tempo de fechamento da vaga | Até 30 dias | UNV Profile (/onboarding-tasks/vagas) |
| Candidatos triados por vaga | 10+ | UNV Profile |
| Aproveitamento do banco de talentos | 1ª fonte consultada em 100% das vagas | UNV Profile |
| Retenção do contratado aos 90 dias | 90%+ | Painel de staff |
| Vagas comerciais com DISC aplicado | 100% | UNV Profile |

## Erros comuns

- **Abrir vaga sem consultar o banco de talentos.** Consequência: semanas de captação pra achar alguém que já estava no sistema.
- **Aceitar currículo fora do link público.** Consequência: candidato sem registro no Profile, processo sem rastro e triagem despadronizada.
- **Pular o DISC na triagem de cargo comercial.** Consequência: contratar perfil errado pra função e descobrir na primeira meta perdida.
- **Contratar comercial sem histórico de meta comprovável.** Consequência: figurante no time — "vendedor que só bate meta quando o dono entra é figurante".
- **Gestor entrevistar antes do fit cultural.** Consequência: hora cara do gestor gasta em candidato que nem deveria estar no funil.
- **Fechar contratação fora do gerador de contratos.** Consequência: contrato sem padrão jurídico e sem registro no sistema.

## Checklist rápido

- [ ] Contratação aprovada pela diretoria antes de abrir a vaga
- [ ] Banco de talentos consultado como primeira fonte
- [ ] Vaga publicada no UNV Profile com requisitos e perfil comportamental
- [ ] Candidaturas só pelo link público (sem login)
- [ ] DISC aplicado na triagem quando aplicável
- [ ] Entrevista RH (fit) antes da técnica (gestor)
- [ ] Histórico de meta comprovável exigido pra comercial
- [ ] Contrato gerado em /contratos/colaboradores
- [ ] Candidatos bons não contratados salvos no banco de talentos$md$ WHERE slug = 'recrutamento-e-selecao';

UPDATE public.staff_processes SET summary = 'Do primeiro dia ao dia 30: acessos, cargo certo no Nexus, leitura do manual e ramp-up específico por função.', content = $md$## Objetivo

Fazer o colaborador novo produzir no padrão UNV o mais rápido possível, sem depender de ninguém ficar "ensinando no grito". Onboarding bem feito é o colaborador com acesso certo, cargo certo e processo lido antes de tocar em cliente. Quando falha, o custo aparece na frente do cliente: acesso faltando, permissão errada e gente improvisando — e improviso não escala.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| RH | Coordena o onboarding, agenda apresentações e a conversa de 30 dias |
| Admin/Master | Cadastra o staff no Nexus com o cargo correto e aprova o acesso no painel |
| Gestor da área | Conduz o ramp-up do cargo, acompanha a evolução e faz a conversa de alinhamento |
| Colaborador novo | Lê o manual, cumpre o ramp-up e traz as travas pro gestor em vez de esconder |

## Quando roda

Gatilho: contrato de colaborador assinado (saída do processo de recrutamento). O cadastro e os acessos acontecem antes ou no primeiro dia — colaborador não pode chegar e ficar esperando login. Duração total: 30 dias, com marcos na semana 1 e nas semanas 2–4.

## Fluxo do processo

```mermaid
flowchart TD
    A["Contrato assinado"] --> B["Cadastro no Nexus como staff com cargo correto"]
    B --> C{"Cargo ainda em pending?"}
    C -->|"sim"| D["Aprovar no painel de staff"]
    C -->|"não"| E["Liberar acessos: CRM, WhatsApp, e-mail, grupos"]
    D --> E
    E --> F["Ler o manual de processos do setor"]
    F --> G["Apresentação ao time e ao UNV Office"]
    G --> H{"Qual área?"}
    H -->|"Comercial"| I["Playbook, escuta de ligações, role play, meta reduzida"]
    H -->|"CS ou Consultor"| J["Acompanhar consultor sênior em 2 ou mais clientes"]
    H -->|"Financeiro, RH, Marketing"| K["Rotina do setor com o gestor + manual"]
    I --> L["Conversa de 30 dias com o gestor"]
    J --> L
    K --> L
```

## Passo a passo

1. **Cadastrar no Nexus como staff com o cargo correto.** Admin/master cadastra o colaborador no painel de staff. Atenção: **o cargo define as permissões de menu** — cargo errado significa a pessoa vendo o que não deve ou sem acesso ao que precisa. Feito = colaborador logando no Nexus com os menus certos do cargo.
2. **Aprovar quem está em "pending".** Colaborador com cargo **"pending" ainda não foi aprovado** e está aguardando liberação. Aprovar no painel de staff assim que a contratação for confirmada — pending esquecido é gente contratada trancada do lado de fora. Feito = nenhum staff ativo em pending.
3. **Liberar os acessos no primeiro dia.** Nexus, CRM, WhatsApp corporativo, e-mail e grupos internos. Testar cada login junto com o colaborador — "vou pedir depois" vira uma semana parado. Feito = todos os acessos testados e funcionando no dia 1.
4. **Ler o manual de processos.** O colaborador lê este manual (unvholdings.com.br/processos), começando pelos **processos do próprio setor e cargo**. O gestor indica a ordem. Isso não é leitura opcional: é o que substitui semanas de "vai perguntando". Feito = colaborador confirma leitura e traz dúvidas por escrito pro gestor.
5. **Apresentar ao time e ao UNV Office.** RH apresenta a pessoa nos grupos internos e no UNV Office. Todo mundo precisa saber quem entrou, pra quê e a quem se reporta. Feito = apresentação feita na semana 1.
6. **Ramp-up comercial (SDR/Closer).** Semanas 2–4: playbook do cargo, escuta de ligações e reuniões gravadas, role play com o gestor e **primeira semana de operação com meta reduzida**. Ninguém pega meta cheia sem ter escutado o jogo real. Feito = role play aprovado pelo gestor antes do primeiro lead real.
7. **Ramp-up de CS/Consultor.** Acompanhar reuniões de gestão de um **consultor sênior em 2 ou mais clientes antes de assumir carteira**. O novo consultor vê como se conduz reunião com métrica na prática — "reunião sem métrica é terapia em grupo". Feito = 2+ clientes acompanhados e aval do sênior pra assumir carteira.
8. **Ramp-up de Financeiro/RH/Marketing.** Rotina do setor lado a lado com o gestor + processos deste manual. O gestor mostra o ciclo completo (semana e mês) antes de delegar. Feito = colaborador executa a rotina da semana sem supervisão direta.
9. **Conversa de 30 dias.** Gestor senta com o colaborador: o que aprendeu, onde travou, meta dos próximos 60 dias. Sai com meta escrita e combinada — não com "tamo junto". Feito = registro da conversa e meta dos 60 dias definida.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Cadastro no Nexus + cargo correto | Antes do 1º dia | Admin/Master |
| Aprovação de cargo pending | Mesmo dia da confirmação | Admin/Master |
| Todos os acessos liberados e testados | Dia 1 | Admin + RH |
| Leitura do manual do setor | Semana 1 | Colaborador |
| Apresentação ao time e UNV Office | Semana 1 | RH |
| Ramp-up por cargo concluído | Semanas 2–4 | Gestor da área |
| Conversa de alinhamento | Dia 30 | Gestor da área |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Acessos completos no dia 1 | 100% dos novos | Painel de staff + checklist do RH |
| Staff em pending com mais de 1 dia | Zero | Painel de staff |
| Ramp-up concluído no prazo | 100% em até 4 semanas | Gestor + RH |
| Conversa de 30 dias realizada | 100% no dia 30 | RH |
| Retenção aos 90 dias | 90%+ | Painel de staff |

## Erros comuns

- **Cadastrar com cargo errado no Nexus.** Consequência: permissões de menu erradas — a pessoa enxerga dado que não devia ou trava sem acesso ao que precisa pra trabalhar.
- **Deixar colaborador em "pending" depois da confirmação.** Consequência: pessoa contratada e paga, sem conseguir operar o sistema.
- **Liberar acessos aos poucos, ao longo de semanas.** Consequência: ramp-up atrasa e o colaborador aprende a improvisar fora do sistema — vício difícil de corrigir depois.
- **Pular a leitura do manual "porque a pessoa tem experiência".** Consequência: experiente fazendo do jeito da empresa anterior, não do jeito UNV.
- **Comercial com meta cheia na primeira semana.** Consequência: lead real queimado por gente que ainda não fez role play.
- **CS assumir carteira sem acompanhar consultor sênior.** Consequência: cliente pagante virando campo de treino — e churn precoce.
- **Não fazer a conversa de 30 dias.** Consequência: travas viram silêncio, silêncio vira desligamento no mês 4.

## Checklist rápido

- [ ] Cadastro no Nexus feito antes do primeiro dia, com cargo correto
- [ ] Nenhum cargo em "pending" após confirmação
- [ ] Nexus, CRM, WhatsApp corporativo, e-mail e grupos testados no dia 1
- [ ] Manual de processos do setor lido na semana 1
- [ ] Apresentação ao time e ao UNV Office feita
- [ ] Comercial: escuta de gravações + role play + primeira semana com meta reduzida
- [ ] CS: 2+ clientes acompanhados com consultor sênior antes de assumir carteira
- [ ] Conversa de 30 dias feita, com meta dos próximos 60 dias registrada$md$ WHERE slug = 'onboarding-colaborador';

UPDATE public.staff_processes SET summary = 'Growth Room, Mansão Empreendedora e imersões: prazos de brinde e material, dinâmicas de co-criação e follow-up em 48h.', content = $md$## Objetivo

Garantir que todo evento UNV — Growth Room, Mansão Empreendedora ou imersão — entregue a mesma experiência premium e gere negócio depois. Evento é canal comercial com prazo físico: brinde e material não aceitam correria de última hora. Quando o processo falha, o resultado aparece na hora: brinde em saco plástico, backdrop atrasado e lead quente esfriando sem follow-up.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Marketing | Coordena o evento: cronograma, materiais de marca, brindes, confirmação e captação |
| Admin | Cotações, fornecedores, logística e contratação de estrutura |
| Master (Fabrício/diretoria) | Aprova tema, formato, orçamento e conduz o conteúdo principal |
| Comercial | Executa o follow-up pós-evento em até 48h com oferta contextual |

## Quando roda

Gatilho: data de evento definida e aprovada pela diretoria. A partir daí, o cronograma roda de trás pra frente a partir da data: brindes em D-35, materiais em D-15, confirmação na semana do evento, follow-up em D+2. Frequência: a cada evento do portfólio (Growth Room recorrente, Mansão Empreendedora e imersões conforme calendário).

## Fluxo do processo

```mermaid
flowchart TD
    A["Data e formato aprovados pela diretoria"] --> B["Cronograma reverso a partir da data"]
    B --> C["D-35 a D-30: cotação e pedido dos brindes premium"]
    C --> D["D-15: materiais de marca prontos"]
    D --> E["Semana do evento: régua de confirmação no WhatsApp"]
    E --> F["Dia do evento: dinâmicas de co-criação"]
    F --> G["Coletar NPS e gravar depoimentos no dia"]
    G --> H["Até 48h depois: follow-up comercial com oferta contextual"]
    H --> I{"Lead avançou?"}
    I -->|"sim"| J["Entra no funil comercial padrão"]
    I -->|"não"| K["Nutrição e convite pro próximo evento"]
```

## Passo a passo

1. **Definir e aprovar o evento.** Diretoria bate o martelo: qual formato (Growth Room, Mansão Empreendedora ou imersão), tema, público, data e orçamento. A Mansão Empreendedora segue identidade dark luxury (preto + dourado); os demais seguem a identidade UNV. Feito = evento aprovado com data e orçamento fechados.
2. **Montar o cronograma reverso.** A partir da data do evento, travar os marcos: D-35 brindes, D-15 materiais, D-7 confirmações, D+2 follow-up. Publicar o cronograma pro time com responsável por entrega. Feito = cronograma com donos e datas.
3. **Cotar e pedir os brindes (D-35 a D-30).** Prazo **não negociável**: cotação de brindes com 30–35 dias de antecedência. Padrão premium da casa: **alumínio preto fosco + gravação a laser dourada + caixa preta com selo**. Nunca saco plástico — o brinde é a marca na mão do participante. Feito = pedido fechado com fornecedor e prazo de entrega confirmado por escrito.
4. **Produzir os materiais de marca (até D-15).** Roll-up, backdrop, crachá e deck prontos **15 dias antes** do evento. Revisar identidade visual antes de mandar pra gráfica — refação em cima da hora custa o dobro e chega errado. Feito = materiais aprovados e em mãos em D-15.
5. **Rodar a régua de confirmação (semana do evento).** Régua de confirmação de presença por WhatsApp na semana do evento. Quem confirma vem; quem some recebe novo toque. Feito = lista final de confirmados na véspera.
6. **Executar as dinâmicas de co-criação.** Padrão UNV = **co-criação com entregável tangível**: o participante sai com algo construído, não com caderno de anotação. Referências da casa: "Máquina de Vendas em 30 Minutos" e Cadeira Quente. Formatos passivos (palestra atrás de palestra, auditoria entre pares) não são padrão da casa. Feito = todo participante saiu com entregável na mão.
7. **Capturar prova social no dia.** NPS do evento coletado no próprio dia + **depoimentos gravados no local**. Depois que o participante foi embora, a chance acabou. Feito = NPS respondido e depoimentos gravados antes do encerramento.
8. **Follow-up comercial em até 48h.** Comercial aborda os participantes em **até 48h com oferta contextual** — conectada ao que a pessoa viveu e construiu no evento, não pitch genérico. Cada participante com dono definido no CRM antes do evento acabar. Feito = 100% dos participantes contatados em D+2, com registro no CRM.
9. **Fechar o pós-evento.** Consolidar: presença vs. confirmados, NPS, leads gerados, reuniões agendadas e vendas atribuídas. Levar o número pra diretoria — evento também passa pelo filtro: deu resultado ou deu foto? Feito = relatório de resultado entregue à diretoria.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Cotação e pedido de brindes | D-35 a D-30 | Admin + Marketing |
| Materiais de marca prontos | D-15 | Marketing |
| Régua de confirmação | Semana do evento | Marketing |
| NPS + depoimentos | No dia do evento | Marketing |
| Follow-up comercial | Até 48h após o evento | Comercial |
| Relatório de resultado | Até 5 dias úteis após o evento | Marketing |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Brindes pedidos no prazo | 100% em D-30 ou antes | Cronograma do evento |
| Materiais prontos em D-15 | 100% | Cronograma do evento |
| Presença vs. confirmados | 80%+ | Lista de confirmação |
| NPS do evento | 8+ | Formulário do dia |
| Follow-up em 48h | 100% dos participantes | CRM |
| Reuniões agendadas pós-evento | Meta definida por evento na aprovação | CRM |

## Erros comuns

- **Deixar a cotação de brinde pra depois de D-30.** Consequência: fornecedor sem prazo, e o evento premium entrega brinde genérico — ou pior, em saco plástico.
- **Aceitar brinde fora do padrão pra "resolver".** Consequência: a marca dark luxury vira lembrancinha de festa; o participante percebe.
- **Materiais chegando na véspera.** Consequência: erro de gráfica sem tempo de refação, backdrop errado no fundo de toda foto do evento.
- **Encher a grade de palestra passiva.** Consequência: participante assiste, não constrói — sai sem entregável e sem motivo pra falar do evento.
- **Deixar NPS e depoimento pra colher "depois por mensagem".** Consequência: taxa de resposta desaba e a prova social do evento se perde.
- **Follow-up depois de uma semana.** Consequência: lead quente esfriou; a janela de 48h existe porque a emoção do evento é o gatilho da conversa comercial.
- **Não medir o resultado comercial do evento.** Consequência: evento vira despesa recorrente sem ninguém saber se dá retorno.

## Checklist rápido

- [ ] Data, formato e orçamento aprovados pela diretoria
- [ ] Cronograma reverso publicado com donos por entrega
- [ ] Brindes cotados e pedidos entre D-35 e D-30
- [ ] Padrão premium conferido: alumínio preto fosco, laser dourado, caixa com selo
- [ ] Roll-up, backdrop, crachá e deck prontos em D-15
- [ ] Régua de confirmação rodando na semana do evento
- [ ] Dinâmicas de co-criação com entregável tangível na grade
- [ ] NPS e depoimentos coletados no dia
- [ ] Follow-up comercial feito em até 48h, registrado no CRM
- [ ] Relatório de resultado entregue à diretoria$md$ WHERE slug = 'padrao-de-eventos';

UPDATE public.staff_processes SET summary = 'Como mudança entra em produção no Nexus: branch, PR, CI no Cloudflare. Nunca main direto, nunca wrangler manual.', content = $md$## Objetivo

Garantir que toda mudança no Nexus chegue em produção por um único caminho auditável: branch, PR, merge e CI. O Nexus roda a operação inteira — CRM, financeiro, clientes, relatórios automáticos. Um deploy fora do processo pode derrubar cobrança, vazar dado entre clientes ou sobrescrever função mais nova em produção. Aqui não existe atalho: o CI é a única via.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Admin/Master (dev) | Desenvolve na branch, abre o PR, confere migrations e edge functions antes de aplicar |
| Revisor do PR | Revisa a mudança antes do merge: regras de dados, RLS, campos monetários |
| Master | Autoriza mudanças sensíveis (dados de cliente, cobrança, permissões) |

## Quando roda

Gatilho: qualquer mudança no Nexus — frontend, migration de banco ou edge function. Sem exceção por tamanho: ajuste de uma linha segue o mesmo fluxo do módulo novo. Frequência: contínua, sob demanda.

## Fluxo do processo

```mermaid
flowchart TD
    A["Mudança necessária no Nexus"] --> B["Criar branch feat ou fix"]
    B --> C{"Mexe no backend?"}
    C -->|"sim"| D["Migration com timestamp em supabase/migrations"]
    C -->|"não"| E["Desenvolver e testar na branch"]
    D --> F{"Edge function envolvida?"}
    F -->|"sim"| G["Conferir versão em produção antes de sobrescrever"]
    F -->|"não"| E
    G --> E
    E --> H["Abrir PR pra main"]
    H --> I["Revisão: RLS, tenant_id, campos _cents"]
    I -->|"aprovado"| J["Merge na main"]
    J --> K["GitHub Actions builda e publica no Cloudflare Worker"]
    K --> L["Validar em produção: unvholdings.com.br"]
```

## Passo a passo

1. **Criar a branch.** Toda mudança nasce numa branch `feat/` ou `fix/`. **Nunca commitar direto na main** — a main é o gatilho de produção, não área de trabalho. Feito = branch criada a partir da main atualizada.
2. **Backend: escrever a migration.** Mudança de banco vai em migration **com timestamp** em `supabase/migrations/`. Nunca alterar schema na mão em produção — mudança sem migration é mudança que ninguém consegue reproduzir nem auditar. Feito = migration no repo, aplicada e testada.
3. **Backend: aplicar as regras de dados invioláveis.** Antes de qualquer merge, conferir três regras: **toda tabela nova nasce com RLS habilitado**; tabelas de cliente white-label **sempre isoladas por tenant_id**; campos monetários — **só os com sufixo `_cents` são centavos**, o resto é valor em reais. Errar a regra de centavos gera valor 100x errado em tela e relatório. Feito = as três regras conferidas na mudança.
4. **Edge functions: conferir produção antes de sobrescrever.** Edge functions são deployadas via **CI próprio**, separado do frontend. Atenção: função editada fora do CI **pode estar mais nova em produção do que no repo**. Antes de mexer, comparar a versão em produção com a do repo — sobrescrever sem conferir apaga correção que já estava no ar. Feito = versão de produção conferida e diferenças incorporadas.
5. **Desenvolver e testar na branch.** Rodar local, testar o fluxo afetado de ponta a ponta. Stack: React + Vite + Tailwind + shadcn/ui no frontend; Supabase (Postgres + Edge Functions) no backend; automações em N8N; WhatsApp via API. Feito = fluxo testado funcionando na branch.
6. **Abrir o PR.** PR pra main com descrição do que muda e por quê. Mudança sensível (dados de cliente, cobrança, permissão) marcada explicitamente pro revisor. Feito = PR aberto com descrição completa.
7. **Revisar.** O revisor confere a mudança com foco nas regras do passo 3 e no impacto em produção. PR sem revisão não entra. Feito = aprovação registrada no PR.
8. **Merge e deploy automático.** Merge na main dispara o **GitHub Actions**, que builda e publica no **Cloudflare Worker** (unv-nexus → unvholdings.com.br). **Nunca rodar deploy manual com wrangler da cópia local** — deploy manual publica estado local não revisado e dessincroniza produção do repo. Feito = Actions verde.
9. **Validar em produção.** Depois do deploy, abrir unvholdings.com.br e testar o fluxo alterado de verdade — não só olhar se o build passou. Deu problema: novo fix pelo mesmo fluxo (branch → PR → merge). Feito = fluxo validado em produção.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Revisão de PR | Até 1 dia útil | Revisor |
| Correção de bug crítico em produção | Mesmo dia, pelo fluxo normal | Dev + Revisor |
| Validação pós-deploy | Até 1h após o merge | Autor da mudança |
| Conferência de edge function vs. produção | Antes de todo deploy de function | Autor da mudança |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Commits diretos na main | Zero | Histórico do GitHub |
| Deploys manuais via wrangler | Zero | Cloudflare + histórico do Actions |
| Builds do Actions verdes | 100% | GitHub Actions |
| Tabelas novas com RLS habilitado | 100% | Revisão de PR + migrations |
| Incidentes por deploy fora do processo | Zero | Registro de incidentes |

## Erros comuns

- **Commitar direto na main.** Consequência: código sem revisão indo direto pra produção — e produção é onde o cliente está.
- **Rodar wrangler da cópia local.** Consequência: publica estado local não revisado e cria produção diferente do repo; o próximo deploy do CI desfaz a mudança sem ninguém entender o sumiço.
- **Sobrescrever edge function sem conferir a versão em produção.** Consequência: apaga correção que estava só em prod — o bug "corrigido" volta.
- **Criar tabela sem RLS.** Consequência: dado exposto pra quem não devia ver. Em tabela white-label sem tenant_id, dado de um cliente vaza pro outro.
- **Tratar campo em reais como centavos (ou o contrário).** Consequência: valores 100x errados em fatura, relatório e dashboard. Só `_cents` é centavo.
- **Alterar schema na mão em produção, sem migration.** Consequência: banco dessincronizado do repo; a próxima migration quebra e ninguém sabe reproduzir o estado.
- **Merge sem validar o fluxo em produção depois.** Consequência: bug descoberto pelo cliente, não pelo time.

## Checklist rápido

- [ ] Branch feat/ ou fix/ criada — nada direto na main
- [ ] Migration com timestamp em supabase/migrations (se mexeu no banco)
- [ ] Tabela nova com RLS habilitado
- [ ] Tabela white-label isolada por tenant_id
- [ ] Campos monetários conferidos: só `_cents` é centavo
- [ ] Edge function: versão em produção conferida antes de sobrescrever
- [ ] PR aberto, revisado e aprovado
- [ ] Deploy só pelo GitHub Actions — zero wrangler manual
- [ ] Fluxo validado em produção após o merge$md$ WHERE slug = 'deploy-nexus';

UPDATE public.staff_processes SET summary = 'As 4 perguntas de toda decisão estratégica: escala, previsibilidade, margem e dependência. Passa em 2 de 4 ou não sobe.', content = $md$## Objetivo

Garantir que toda decisão estratégica da UNV — projeto, produto, contratação ou investimento — seja filtrada pelos mesmos 4 critérios antes de consumir tempo de diretoria. O filtro protege o foco: sem ele, a empresa vira coleção de boas ideias que não escalam, não geram previsibilidade, não melhoram margem e criam dependência. É o mecanismo que mantém a UNV no rumo da visão: ser a maior empresa do Brasil em terceirização de gestão comercial, com tecnologia própria e foco total em resultado.

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Proponente (qualquer líder) | Estrutura a proposta e responde às 4 perguntas por escrito, com número |
| Head comercial / Admin | Faz a pré-triagem: proposta que não passa em 2 de 4 não sobe |
| Master (diretoria) | Decide sobre as propostas que passaram no filtro e acompanha as métricas |

## Quando roda

Gatilho: qualquer proposta de projeto novo, produto novo, contratação ou investimento. O filtro roda **antes** da proposta entrar em pauta de diretoria — não durante a reunião. Também vale pra decisões de continuidade: iniciativa rodando que não passa mais no filtro entra em revisão.

## Fluxo do processo

```mermaid
flowchart TD
    A["Proposta: projeto, produto, contratação ou investimento"] --> B["Responder às 4 perguntas por escrito"]
    B --> C{"Escala? Funciona com 10x o volume sem 10x o custo?"}
    C --> D{"Gera previsibilidade? Receita recorrente ou pontual?"}
    D --> E{"Aumenta margem? Lucro ou só faturamento?"}
    E --> F{"Reduz dependência? De dono, pessoa, canal ou cliente?"}
    F --> G{"Passou em pelo menos 2 de 4?"}
    G -->|"não"| H["Não sobe pra decisão: arquivar ou reformular"]
    G -->|"sim"| I["Entra na pauta da diretoria com número"]
    I --> J{"Aprovada?"}
    J -->|"sim"| K["Executa com meta específica e responsável"]
    J -->|"não"| H
    K --> L["Acompanhar nas métricas da diretoria"]
```

## Passo a passo

1. **Escrever a proposta.** Uma página: o que é, quanto custa, o que espera de retorno e em quanto tempo. Proposta falada em corredor não é proposta. Feito = documento curto com números.
2. **Passar pela pergunta 1 — escala.** "Funciona com 10x o volume sem 10x o custo?" Se dobrar o resultado exige dobrar o time, não escala — é serviço linear, e a resposta é "não". Feito = resposta sim/não com justificativa de uma linha.
3. **Passar pela pergunta 2 — previsibilidade.** "Cria receita ou resultado recorrente, ou é pontual?" Receita que se repete todo mês vale mais que pico isolado. Feito = resposta com a natureza da receita (recorrente ou pontual) explícita.
4. **Passar pela pergunta 3 — margem.** "Melhora o lucro ou só o faturamento?" Crescimento sem margem não passa no filtro — faturamento alto com lucro baixo é vaidade cara. Feito = impacto estimado em margem, não só em receita.
5. **Passar pela pergunta 4 — dependência.** "Reduz dependência do dono, de uma pessoa, de um canal ou de um cliente?" Proposta que concentra ainda mais a operação numa pessoa ou num canal responde "não" aqui. Feito = mapeado o que a proposta faz com cada dependência.
6. **Aplicar a régua: 2 de 4.** **Proposta que não passa em pelo menos 2 dos 4 critérios não sobe pra decisão.** Não é debate, é corte. O proponente pode reformular e tentar de novo — a versão nova responde às mesmas 4 perguntas. Feito = veredito registrado: sobe ou não sobe.
7. **Decidir com número na mesa.** Na pauta de diretoria, a proposta é avaliada pelas métricas da casa: ticket médio, conversão, CAC, LTV, churn, NPS e lucro líquido. Meta sempre específica — "aumentar ticket médio", "reduzir CAC" — **nunca "vender mais" genérico**. Feito = decisão registrada com meta, prazo e responsável.
8. **Acompanhar o que foi aprovado.** Iniciativa aprovada entra no acompanhamento das métricas da diretoria. Se depois de rodar ela não passa mais no filtro (não escalou, não gerou recorrência, comeu margem, criou dependência), volta pra revisão — aprovar não é vitalício. Feito = revisão periódica com as mesmas 4 perguntas.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Proposta por escrito com as 4 respostas | Antes de pedir pauta | Proponente |
| Pré-triagem (2 de 4) | Até 2 dias úteis | Head comercial / Admin |
| Decisão da diretoria | Na pauta seguinte à triagem | Master |
| Revisão de iniciativa aprovada | A cada ciclo de resultado (mensal/trimestral) | Master + responsável |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Propostas que chegam à diretoria já filtradas | 100% com as 4 respostas por escrito | Pauta da diretoria |
| Propostas aprovadas com meta específica e responsável | 100% | Registro de decisões |
| Iniciativas ativas revisadas no ciclo | 100% | Acompanhamento da diretoria |
| Métricas da diretoria com dono e acompanhamento | Ticket médio, conversão, CAC, LTV, churn, NPS, lucro líquido | Painéis do Nexus |

## Erros comuns

- **Levar proposta pra diretoria sem passar pelo filtro.** Consequência: reunião de diretoria virando sessão de brainstorm — decisão cara sendo tomada no improviso.
- **Responder as 4 perguntas com adjetivo em vez de número.** Consequência: "tem muito potencial" passa qualquer coisa; sem número, o filtro vira formalidade.
- **Aprovar por empolgação algo que passou em 1 de 4.** Consequência: a régua perde valor — se a exceção é fácil, a regra não existe.
- **Definir meta genérica ("vender mais", "crescer").** Consequência: ninguém sabe se deu certo; meta sem métrica específica não cobra ninguém.
- **Nunca revisar o que já foi aprovado.** Consequência: iniciativa zumbi consumindo caixa e gente por inércia, anos depois de ter parado de fazer sentido.
- **Usar o filtro só pra ideia dos outros.** Consequência: as apostas da própria diretoria viram ponto cego — o filtro vale pra todo mundo, inclusive pro dono.

## Checklist rápido

- [ ] Proposta escrita em uma página, com números
- [ ] Pergunta 1 respondida: escala sem multiplicar custo?
- [ ] Pergunta 2 respondida: recorrente ou pontual?
- [ ] Pergunta 3 respondida: impacto em margem, não só em faturamento
- [ ] Pergunta 4 respondida: reduz dependência de dono, pessoa, canal ou cliente?
- [ ] Régua aplicada: passou em pelo menos 2 de 4?
- [ ] Decisão com meta específica, prazo e responsável
- [ ] Iniciativas aprovadas revisadas no ciclo com as mesmas 4 perguntas$md$ WHERE slug = 'filtro-de-decisao';

UPDATE public.staff_processes SET summary = 'Portfólio e regras fixas: valores só na aba Produtos e Valores, pré-requisitos do Sales Force e ICP mínimo.', content = $md$## Objetivo

Garantir que todo mundo que vende ou entrega UNV trabalhe com o mesmo portfólio, os mesmos pré-requisitos e a mesma fonte de preço. Preço decorado e planilha antiga geram proposta errada, margem corroída e cliente comprando produto que a entrega não sustenta. Este processo separa o que muda (valores — sempre na aba viva) do que não muda (regras comerciais).

## Quem faz

| Papel | Responsabilidade |
|---|---|
| Closer | Monta proposta usando a aba Produtos & Valores e valida pré-requisitos antes de ofertar |
| Head comercial | Garante que o time só oferta dentro das regras; primeiro nível de escalada de desconto |
| Master/Admin (diretoria) | Aprova descontos acima da alçada e mantém o catálogo do sistema atualizado |
| Financeiro | Classifica a receita corretamente (recorrente vs. pontual) conforme a forma de pagamento |

## Quando roda

Gatilho: toda montagem de proposta comercial, toda dúvida de preço e toda revisão de portfólio. As regras valem em qualquer negociação, sem exceção. Consulta à aba Produtos & Valores: a cada proposta, sempre — nunca de memória.

## Fluxo do processo

```mermaid
flowchart TD
    A["Diagnóstico feito, hora de montar a proposta"] --> B{"Lead está no ICP? 1+ vendedor e faturamento mínimo"}
    B -->|"não"| C["Não ofertar: nutrir até amadurecer"]
    B -->|"sim"| D["Escolher produtos no portfólio"]
    D --> E{"Inclui Sales Force?"}
    E -->|"sim"| F{"Cliente tem 200 leads por mês e tráfego mínimo?"}
    F -->|"não"| G["Não vender Sales Force: ofertar caminho pra construir a base antes"]
    F -->|"sim"| H["Consultar valores na aba Produtos e Valores"]
    E -->|"não"| H
    H --> I{"Desconto dentro da alçada do closer?"}
    I -->|"não"| J["Escalar pra aprovação da diretoria"]
    I -->|"sim"| K["Enviar proposta"]
    J --> K
    K --> L["Fechou? Financeiro classifica: mensal entra no MRR, cartão parcelado não"]
```

## Passo a passo

1. **Validar o ICP antes de qualquer oferta.** ICP mínimo: **1+ vendedor e faturamento acima de R$50 mil/mês**. Lead fora do ICP não recebe proposta — recebe direcionamento e entra em nutrição até amadurecer. Vender pra quem não tem base é churn contratado. Feito = faturamento e nº de vendedores confirmados no cadastro do lead.
2. **Conhecer a estrutura do portfólio.** Três camadas: **Núcleo** — Diretor Comercial Terceirizado (produto principal), Sales Force (SDR + Closer), Sales Ops, Sales Acceleration, Sales Core, Sales Control. **Complementares** — UNV Ads (tráfego), UNV Social, UNV InCompany, UNV People (RH), UNV Finance, UNV Safe (jurídico), UNV Leadership. **Premium** — UNV Mastermind, UNV Partners, UNV Growth Room, Mansão Empreendedora. Feito = proposta montada com produtos que resolvem o gargalo diagnosticado, começando pelo núcleo.
3. **Consultar os valores na aba Produtos & Valores.** Os preços vigentes estão na aba **Produtos & Valores** deste manual — puxados em tempo real do catálogo do sistema. **Não usar valor decorado nem planilha antiga.** Preço muda; a aba acompanha, a memória não. Feito = todo valor da proposta conferido na aba no dia do envio.
4. **Validar os pré-requisitos do Sales Force.** Sales Force exige **200 leads/mês e tráfego mínimo de R$2 mil/mês do cliente**. Sem isso, **não vender** — a entrega quebra: SDR sem lead pra ligar não agenda, closer sem agenda não fecha, e o cliente cancela culpando a UNV. Cliente sem a base: ofertar o caminho pra construí-la primeiro (ex.: tráfego + estruturação) e deixar o Sales Force pro momento certo. Feito = volume de leads e investimento em tráfego confirmados antes da oferta.
5. **Tratar desconto pela alçada.** Desconto dentro da alçada do closer: pode aplicar, defendendo valor com ROI antes (filosofia da casa: nunca dar desconto antes de defender valor). **Desconto além da alçada do closer → aprovação da diretoria**, antes de prometer qualquer coisa pro cliente. Feito = desconto fora da alçada com aprovação registrada.
6. **Classificar a receita na forma de pagamento.** **Parcelamento em cartão (6/12x) não entra no MRR** — é receita pontual no planejamento. Contrato mensal entra no MRR. Fechou no cartão: avisar o financeiro pra classificação correta, senão o MRR infla e a diretoria planeja em cima de número errado. Feito = forma de pagamento registrada e receita classificada.
7. **Manter o catálogo como fonte única.** Mudança de preço ou produto novo: diretoria atualiza o **catálogo do sistema** — a aba Produtos & Valores reflete na hora pra todo o time. Nunca comunicar preço novo por mensagem avulsa sem atualizar o catálogo. Feito = catálogo atualizado antes de qualquer comunicação de mudança.

## Prazos e SLAs

| Etapa | Prazo | Responsável |
|---|---|---|
| Consulta à aba Produtos & Valores | Em toda proposta, no dia do envio | Closer |
| Validação de ICP e pré-requisitos | Antes da oferta, na qualificação/diagnóstico | Closer + SDR |
| Aprovação de desconto fora da alçada | Até 1 dia útil | Diretoria |
| Atualização do catálogo após mudança de preço | Mesmo dia da decisão | Diretoria |
| Classificação da receita (MRR vs. pontual) | No fechamento do contrato | Financeiro |

## Métricas do processo

| Métrica | Meta | Onde acompanhar |
|---|---|---|
| Propostas com valor conferido na aba viva | 100% | Auditoria de propostas no CRM |
| Vendas de Sales Force com pré-requisitos validados | 100% | CRM + checklist da proposta |
| Vendas fora do ICP | Zero | CRM (cadastro do lead) |
| Descontos fora da alçada sem aprovação | Zero | Registro de aprovações |
| Ticket médio | Crescente por ciclo | Painéis de metas e KPIs |

## Erros comuns

- **Usar preço decorado ou planilha antiga.** Consequência: proposta com valor defasado — ou a UNV perde margem, ou o cliente recebe reajuste constrangedor depois do sim.
- **Vender Sales Force pra cliente sem 200 leads/mês e sem tráfego mínimo.** Consequência: a entrega quebra nos primeiros 60 dias e o cancelamento vem com a culpa no nosso colo.
- **Ofertar pra lead fora do ICP pra "não perder a venda".** Consequência: cliente sem base pra ter resultado, churn precoce e NPS afundando.
- **Dar desconto antes de defender valor com ROI.** Consequência: treina o mercado a esperar desconto e corrói a margem — vai contra a filosofia de venda da casa.
- **Prometer desconto fora da alçada e pedir aprovação depois.** Consequência: diretoria encurralada entre honrar prejuízo ou desdizer o closer na frente do cliente.
- **Contar cartão parcelado como MRR.** Consequência: receita recorrente inflada, planejamento e projeção de caixa errados.
- **Escrever preço em documento estático (playbook, PDF, mensagem fixada).** Consequência: nasce desatualizado — valor vivo mora no catálogo, e ponto.

## Checklist rápido

- [ ] ICP validado: 1+ vendedor e faturamento acima de R$50 mil/mês
- [ ] Produto proposto resolve o gargalo do diagnóstico
- [ ] Valores conferidos na aba Produtos & Valores no dia do envio
- [ ] Sales Force só com 200 leads/mês e tráfego mínimo confirmados
- [ ] Valor defendido com ROI antes de qualquer desconto
- [ ] Desconto fora da alçada aprovado pela diretoria antes de prometer
- [ ] Forma de pagamento registrada; cartão 6/12x fora do MRR
- [ ] Nenhum preço escrito em documento estático$md$ WHERE slug = 'portfolio-e-precificacao';
