// Configuração dos tipos de entregável do UNV Board.
// Cada tipo tem um formulário guiado com perguntas práticas que o dono
// da empresa consegue responder — as respostas viram matéria-prima
// pro board-engine (action generate_deliverable) redigir o documento.

export type BoardDeliverableType =
  | "raiox"
  | "metas"
  | "icp"
  | "playbook"
  | "processos"
  | "script"
  | "calendario"
  | "book"
  | "outro"
  | "execucao";

export interface DeliverableFormField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "textarea" | "list";
}

export interface DeliverableTypeConfig {
  label: string;
  description: string;
  fields: DeliverableFormField[];
}

export const BOARD_DELIVERABLE_TYPES: Record<BoardDeliverableType, DeliverableTypeConfig> = {
  raiox: {
    label: "Raio-X Comercial",
    description: "Diagnóstico completo da sua operação de vendas: pontos fortes, gargalos e recomendações.",
    fields: [
      {
        key: "como_vende_hoje",
        label: "Como funciona a venda hoje, do lead até o fechamento?",
        placeholder: "Ex.: o cliente chega pelo Instagram, a secretária responde no WhatsApp, agenda uma visita e eu fecho pessoalmente...",
        type: "textarea",
      },
      {
        key: "time_comercial",
        label: "Quantas pessoas vendem e qual o papel de cada uma?",
        placeholder: "Ex.: 2 vendedores internos + eu fechando os maiores",
        type: "text",
      },
      {
        key: "metricas_acompanhadas",
        label: "Quais números você acompanha hoje? (um por linha)",
        placeholder: "Faturamento do mês\nQuantidade de vendas\nLeads que chegam",
        type: "list",
      },
      {
        key: "usa_crm",
        label: "Usa CRM ou planilha? Como registra os contatos?",
        placeholder: "Ex.: planilha no Excel / CRM mas ninguém preenche / não registra",
        type: "text",
      },
      {
        key: "tem_metas",
        label: "Existem metas definidas? Quais?",
        placeholder: "Ex.: meta de R$100 mil/mês, mas sem meta por vendedor",
        type: "text",
      },
      {
        key: "maior_gargalo",
        label: "Na sua visão, qual o maior gargalo da operação hoje?",
        placeholder: "Ex.: chega lead mas o time demora a responder e esfria...",
        type: "textarea",
      },
      {
        key: "ja_tentou",
        label: "O que você já tentou que não funcionou?",
        placeholder: "Ex.: contratei agência de tráfego, entrou lead ruim; contratei vendedor que não performou...",
        type: "textarea",
      },
    ],
  },
  metas: {
    label: "Planejamento de Metas",
    description: "Meta anual quebrada mês a mês, com metas por vendedor e o ritual de acompanhamento.",
    fields: [
      {
        key: "faturamento_atual",
        label: "Quanto a empresa fatura por mês hoje (média)?",
        placeholder: "Ex.: R$ 120.000",
        type: "text",
      },
      {
        key: "meta_anual",
        label: "Qual a meta de faturamento pro ano?",
        placeholder: "Ex.: R$ 2.000.000",
        type: "text",
      },
      {
        key: "ticket_medio",
        label: "Qual o ticket médio de venda?",
        placeholder: "Ex.: R$ 3.500",
        type: "text",
      },
      {
        key: "conversao",
        label: "De cada 10 atendimentos, quantos viram venda?",
        placeholder: "Ex.: 3 de 10",
        type: "text",
      },
      {
        key: "time_vendas",
        label: "Quantos vendedores e quem são? (um por linha)",
        placeholder: "João — interno\nMaria — externa",
        type: "list",
      },
      {
        key: "sazonalidade",
        label: "Quais meses são fortes e quais são fracos pro seu negócio?",
        placeholder: "Ex.: maio e dezembro são fortes; janeiro e fevereiro caem 40%",
        type: "textarea",
      },
      {
        key: "acompanhamento_hoje",
        label: "Como você acompanha o resultado hoje?",
        placeholder: "Ex.: olho o caixa no fim do mês / reunião semanal com o time",
        type: "textarea",
      },
    ],
  },
  icp: {
    label: "ICP e Proposta de Valor",
    description: "Perfil do cliente ideal, quem NÃO é cliente e a proposta de valor que diferencia sua empresa.",
    fields: [
      {
        key: "melhor_cliente",
        label: "Descreva o melhor cliente que você já teve. Por que ele foi bom?",
        placeholder: "Ex.: clínica de médio porte, pagou sem chorar desconto, indicou 3 outros...",
        type: "textarea",
      },
      {
        key: "perfil_tipico",
        label: "Qual o segmento e porte típico dos seus bons clientes?",
        placeholder: "Ex.: comércio local faturando de 50 a 300 mil/mês",
        type: "text",
      },
      {
        key: "dores_cliente",
        label: "Quais problemas seu cliente quer resolver quando te procura? (um por linha)",
        placeholder: "Não consegue atrair cliente novo\nEquipe desmotivada\nMargem apertada",
        type: "list",
      },
      {
        key: "quem_decide",
        label: "Quem decide a compra do seu produto/serviço?",
        placeholder: "Ex.: o dono, às vezes junto com a esposa/sócio",
        type: "text",
      },
      {
        key: "onde_esta",
        label: "Onde esse cliente está? Como ele te encontra hoje?",
        placeholder: "Ex.: Instagram, indicação, Google",
        type: "text",
      },
      {
        key: "quem_nao_e",
        label: "Quem NÃO é seu cliente? Que perfil dá problema?",
        placeholder: "Ex.: quem só olha preço, empresa muito pequena que não paga...",
        type: "textarea",
      },
      {
        key: "diferenciais",
        label: "Por que o cliente escolhe você e não o concorrente? (um por linha)",
        placeholder: "Atendimento rápido\nGarantia de 30 dias\n15 anos de mercado",
        type: "list",
      },
    ],
  },
  playbook: {
    label: "Playbook de Vendas",
    description: "O manual oficial de como se vende na sua empresa: processo, objeções, regras e rotina.",
    fields: [
      {
        key: "chegada_lead",
        label: "Como o lead chega hoje na empresa?",
        placeholder: "Ex.: anúncio no Instagram cai no WhatsApp; indicação liga direto...",
        type: "textarea",
      },
      {
        key: "etapas_venda",
        label: "Quais as etapas do primeiro contato até fechar? (uma por linha)",
        placeholder: "Primeiro contato no WhatsApp\nQualificação\nVisita/reunião\nProposta\nFechamento",
        type: "list",
      },
      {
        key: "objecoes",
        label: "Quais as objeções mais comuns que você escuta? (uma por linha)",
        placeholder: "Está caro\nVou pensar\nPreciso falar com meu sócio",
        type: "list",
      },
      {
        key: "regras_desconto",
        label: "Quais as regras de desconto e negociação?",
        placeholder: "Ex.: até 5% o vendedor decide; acima disso só com o dono; à vista 10%",
        type: "textarea",
      },
      {
        key: "rotina_time",
        label: "Como é a rotina do time comercial hoje (dia a dia, reuniões)?",
        placeholder: "Ex.: cada um se organiza sozinho; reunião quando dá problema...",
        type: "textarea",
      },
      {
        key: "metas_atuais",
        label: "Quais as metas atuais do time?",
        placeholder: "Ex.: R$ 50 mil/mês por vendedor",
        type: "text",
      },
      {
        key: "ferramentas",
        label: "Quais ferramentas o time usa? (CRM, WhatsApp, planilha...)",
        placeholder: "Ex.: WhatsApp Business e uma planilha compartilhada",
        type: "text",
      },
    ],
  },
  processos: {
    label: "Processos Comerciais (POP)",
    description: "Seus processos de venda documentados passo a passo, com responsável e prazo de cada etapa.",
    fields: [
      {
        key: "processos_documentar",
        label: "Quais processos você quer documentar? (um por linha)",
        placeholder: "Atendimento de lead novo no WhatsApp\nEnvio de proposta\nPós-venda",
        type: "list",
      },
      {
        key: "responsaveis",
        label: "Quem executa cada um desses processos hoje?",
        placeholder: "Ex.: a recepcionista atende o lead; eu monto a proposta...",
        type: "textarea",
      },
      {
        key: "passo_a_passo",
        label: "Descreva o passo a passo do processo mais importante, do seu jeito",
        placeholder: "Ex.: chega mensagem, a Ana responde com o cardápio de serviços, pergunta o que a pessoa precisa...",
        type: "textarea",
      },
      {
        key: "ferramentas",
        label: "Quais ferramentas são usadas nesses processos?",
        placeholder: "Ex.: WhatsApp, planilha, sistema de agendamento",
        type: "text",
      },
      {
        key: "prazos",
        label: "Existe prazo pra cada etapa? Qual deveria ser?",
        placeholder: "Ex.: lead tem que ser respondido em até 10 minutos",
        type: "text",
      },
      {
        key: "bem_executado",
        label: "Como você sabe que o processo foi bem executado?",
        placeholder: "Ex.: cliente respondido rápido, proposta enviada no mesmo dia, follow-up feito...",
        type: "textarea",
      },
    ],
  },
  script: {
    label: "Script de Vendas",
    description: "Scripts prontos pra uso: abertura, qualificação, contorno de objeções e fechamento.",
    fields: [
      {
        key: "produto",
        label: "O que exatamente você vende (produto/serviço principal)?",
        placeholder: "Ex.: pacote de tratamento estético de 6 sessões",
        type: "text",
      },
      {
        key: "canal",
        label: "Qual o canal principal de venda?",
        placeholder: "Ex.: WhatsApp / ligação / presencial na loja",
        type: "text",
      },
      {
        key: "abertura_atual",
        label: "Como o time abre a conversa com o cliente hoje?",
        placeholder: "Ex.: 'Oi, tudo bem? Vi que você se interessou pelo nosso anúncio...'",
        type: "textarea",
      },
      {
        key: "perguntas_qualificacao",
        label: "Que perguntas vocês fazem pra entender o cliente? (uma por linha)",
        placeholder: "O que te trouxe até a gente?\nJá fez algum tratamento antes?\nPra quando você precisa?",
        type: "list",
      },
      {
        key: "objecoes",
        label: "Quais objeções mais aparecem? (uma por linha)",
        placeholder: "Está caro\nVou pesquisar mais\nDepois eu volto",
        type: "list",
      },
      {
        key: "fechamento_atual",
        label: "Como vocês tentam fechar a venda hoje?",
        placeholder: "Ex.: mando o valor e fico esperando o cliente responder...",
        type: "textarea",
      },
      {
        key: "diferenciais",
        label: "Quais diferenciais o vendedor pode usar como argumento? (um por linha)",
        placeholder: "Parcelamento em 12x\nResultado garantido\nAtendimento no mesmo dia",
        type: "list",
      },
    ],
  },
  calendario: {
    label: "Calendário Comercial",
    description: "As campanhas e datas fortes do ano planejadas com antecedência, oferta e canal definidos.",
    fields: [
      {
        key: "datas_segmento",
        label: "Quais datas são fortes pro seu segmento? (uma por linha)",
        placeholder: "Dia das Mães\nBlack Friday\nNatal\nAniversário da loja",
        type: "list",
      },
      {
        key: "campanhas_passadas",
        label: "Que campanhas ou promoções já funcionaram bem?",
        placeholder: "Ex.: Black Friday do ano passado dobrou o faturamento com 20% off...",
        type: "textarea",
      },
      {
        key: "datas_este_ano",
        label: "Quais datas/campanhas você quer trabalhar este ano? (uma por linha)",
        placeholder: "Dia das Mães em maio\nSemana do cliente em setembro\nBlack Friday",
        type: "list",
      },
      {
        key: "canais",
        label: "Quais canais você tem pra divulgar? (Instagram, WhatsApp, e-mail...)",
        placeholder: "Ex.: Instagram com 8 mil seguidores e lista de 2 mil clientes no WhatsApp",
        type: "text",
      },
      {
        key: "verba",
        label: "Quanto costuma investir em divulgação por campanha?",
        placeholder: "Ex.: R$ 2.000 em tráfego pago",
        type: "text",
      },
      {
        key: "capacidade",
        label: "Se a campanha bombar, sua operação dá conta? Qual o limite?",
        placeholder: "Ex.: consigo atender no máximo 60 clientes/semana com o time atual",
        type: "textarea",
      },
    ],
  },
  book: {
    label: "Book do Ano",
    description: "O resumo oficial do ano: evolução dos números, conquistas e o direcionamento pro próximo ciclo.",
    fields: [
      {
        key: "resultados_ano",
        label: "Quais foram os principais resultados do ano?",
        placeholder: "Ex.: crescemos 35%, contratamos 2 vendedores, estruturamos o comercial...",
        type: "textarea",
      },
      {
        key: "numeros_antes_depois",
        label: "Compare os números: como começou e como terminou o ano?",
        placeholder: "Ex.: faturamento de 80k/mês pra 130k/mês; conversão de 20% pra 32%...",
        type: "textarea",
      },
      {
        key: "documentos_construidos",
        label: "Quais documentos/entregáveis foram construídos no Board? (um por linha)",
        placeholder: "Raio-X Comercial\nPlaybook de Vendas\nPlanejamento de Metas",
        type: "list",
      },
      {
        key: "conquistas",
        label: "Quais as maiores conquistas do ano? (uma por linha)",
        placeholder: "Primeiro mês acima de 150k\nTime batendo meta sem o dono vender",
        type: "list",
      },
      {
        key: "desafios",
        label: "Quais foram os maiores desafios enfrentados?",
        placeholder: "Ex.: troca de vendedor no meio do ano, queda no segundo trimestre...",
        type: "textarea",
      },
      {
        key: "foco_proximo_ano",
        label: "Qual o foco pro próximo ano?",
        placeholder: "Ex.: dobrar o time comercial e abrir segunda unidade",
        type: "textarea",
      },
    ],
  },
  execucao: {
    label: "Relatório de Execução",
    description: "Relate como a ação foi executada",
    fields: [
      {
        key: "o_que_foi_feito",
        label: "O que foi feito na prática?",
        placeholder: "Ex.: montamos a planilha de acompanhamento e apresentamos pro time na segunda-feira...",
        type: "textarea",
      },
      {
        key: "como_foi_feito",
        label: "Como foi feito? Descreva o passo a passo",
        placeholder: "Ex.: primeiro levantei os números do mês, depois reuni o time, depois definimos os responsáveis...",
        type: "textarea",
      },
      {
        key: "resultados_obtidos",
        label: "Resultados obtidos — números, se houver",
        placeholder: "Ex.: taxa de resposta caiu de 2h pra 15 min; 12 propostas enviadas na semana...",
        type: "textarea",
      },
      {
        key: "dificuldades",
        label: "Dificuldades encontradas",
        placeholder: "Ex.: parte do time resistiu no começo; faltou tempo pra treinar todo mundo...",
        type: "textarea",
      },
      {
        key: "proximos_passos",
        label: "Próximos passos sugeridos",
        placeholder: "Ex.: revisar os números com o time toda sexta e ajustar o processo no fim do mês...",
        type: "textarea",
      },
    ],
  },
  outro: {
    label: "Documento Personalizado",
    description: "Um documento sob medida a partir das informações que você fornecer.",
    fields: [
      {
        key: "titulo_documento",
        label: "Qual o título do documento?",
        placeholder: "Ex.: Política de Comissionamento",
        type: "text",
      },
      {
        key: "objetivo",
        label: "Qual o objetivo desse documento? Pra que ele vai servir?",
        placeholder: "Ex.: deixar claro pro time como funciona a comissão de cada venda",
        type: "textarea",
      },
      {
        key: "conteudo_base",
        label: "Escreva tudo que você sabe/quer que entre no documento",
        placeholder: "Despeje aqui as informações, mesmo desorganizadas — a IA estrutura",
        type: "textarea",
      },
      {
        key: "publico",
        label: "Quem vai ler esse documento?",
        placeholder: "Ex.: os vendedores / os sócios / clientes",
        type: "text",
      },
    ],
  },
};

// "execucao" é exclusivo do formulário público de tarefa (BoardTaskFormPage) —
// não aparece no catálogo de criação da Biblioteca Comercial.
export const BOARD_DELIVERABLE_TYPE_KEYS = (
  Object.keys(BOARD_DELIVERABLE_TYPES) as BoardDeliverableType[]
).filter((k) => k !== "execucao");

export function boardDeliverableLabel(type: string | null | undefined): string {
  if (!type) return "Documento";
  return BOARD_DELIVERABLE_TYPES[type as BoardDeliverableType]?.label || "Documento";
}
