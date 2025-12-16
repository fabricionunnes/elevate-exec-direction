import { 
  Layers, 
  RefreshCw, 
  TrendingUp, 
  MapPin, 
  Crown, 
  Users2, 
  Megaphone, 
  MessageSquare, 
  Star, 
  Brain,
  Zap,
  DollarSign,
  Users,
  Heart
} from "lucide-react";

export interface ProductProblemSolution {
  problem: string;
  solution: string;
  result: string;
}

export interface ProductDetail {
  id: string;
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  price: string;
  priceType: string;
  description: string;
  deliverables: string[];
  bestFor: string;
  whyRecommended: string;
  problemsSolved: ProductProblemSolution[];
  keyBenefits: string[];
  timeToResults: string;
  idealProfile: string[];
  notFor: string[];
}

export const productDetails: Record<string, ProductDetail> = {
  core: {
    id: "core",
    name: "UNV Core",
    tagline: "Fundação Comercial Inicial",
    icon: Layers,
    color: "bg-blue-500",
    price: "R$ 1.997",
    priceType: "único",
    description: "Produto de entrada para empresas que precisam estruturar sua base comercial do zero.",
    deliverables: [
      "Diagnóstico comercial direcional",
      "Estruturação básica de funil de vendas",
      "Scripts essenciais de abordagem",
      "Definição de metas básicas",
      "UNV AI Advisor nível básico",
      "Cobrança básica de execução"
    ],
    bestFor: "Empresas com faturamento até R$ 150k/mês que estão começando a organizar vendas",
    whyRecommended: "Você está no momento de estruturar a base. O Core vai te dar a fundação necessária para crescer com método.",
    problemsSolved: [
      {
        problem: "Vendas acontecem sem método, na base da sorte",
        solution: "Estruturação de funil de vendas com etapas claras e mensuráveis",
        result: "Você sabe exatamente onde cada lead está e o que fazer para avançá-lo"
      },
      {
        problem: "Não sabe o que falar para o cliente em cada momento",
        solution: "Scripts de abordagem prontos para cada fase do funil",
        result: "Comunicação padronizada que gera mais confiança e conversão"
      },
      {
        problem: "Não tem metas claras nem sabe quanto precisa vender",
        solution: "Definição de metas básicas baseadas em capacidade real",
        result: "Clareza de onde precisa chegar e como medir progresso"
      },
      {
        problem: "Vendas dependem 100% de você, dono do negócio",
        solution: "Processo documentado que qualquer pessoa pode seguir",
        result: "Base para delegar vendas ou contratar seu primeiro vendedor"
      }
    ],
    keyBenefits: [
      "Sair do amadorismo comercial",
      "Ter um processo replicável",
      "Medir resultados pela primeira vez",
      "Preparar base para escalar"
    ],
    timeToResults: "30-60 dias para ver os primeiros resultados",
    idealProfile: [
      "Faturamento até R$ 150k/mês",
      "Vende sozinho ou com 1-2 pessoas",
      "Nunca estruturou vendas antes",
      "Quer começar certo"
    ],
    notFor: [
      "Quem já tem processo comercial funcionando",
      "Empresas com time comercial estruturado",
      "Quem busca acelerar vendas já consistentes"
    ]
  },
  control: {
    id: "control",
    name: "UNV Control",
    tagline: "Direção Comercial Recorrente",
    icon: RefreshCw,
    color: "bg-emerald-500",
    price: "R$ 5.997",
    priceType: "/ano",
    description: "Acompanhamento mensal recorrente para manter a disciplina comercial ativa.",
    deliverables: [
      "Direção estratégica mensal",
      "Acompanhamento via AI semanal",
      "Templates e scripts prontos",
      "Cobrança de execução contínua",
      "Acesso à comunidade UNV",
      "UNV AI Advisor nível execução"
    ],
    bestFor: "Empresas de R$ 100k a R$ 400k/mês que já vendem mas perdem ritmo sem cobrança externa",
    whyRecommended: "Você já tem vendas acontecendo, mas precisa de constância. O Control mantém a disciplina mês a mês.",
    problemsSolved: [
      {
        problem: "Vendas boas um mês, péssimas no outro — montanha-russa de faturamento",
        solution: "Direção estratégica mensal com cobrança de execução contínua",
        result: "Previsibilidade de receita e crescimento constante"
      },
      {
        problem: "Sabe o que fazer mas não consegue manter disciplina sozinho",
        solution: "Acompanhamento semanal via AI + direção mensal",
        result: "Alguém cobrando você toda semana, impossível perder o ritmo"
      },
      {
        problem: "Não tem com quem trocar sobre desafios comerciais",
        solution: "Comunidade de empresários com os mesmos desafios",
        result: "Rede de apoio e benchmarks de quem está no mesmo nível"
      },
      {
        problem: "Fica reinventando a roda em cada problema comercial",
        solution: "Templates e scripts prontos para as situações mais comuns",
        result: "Não perde tempo criando, só executa o que já funciona"
      }
    ],
    keyBenefits: [
      "Consistência de execução comercial",
      "Alguém para cobrar resultados",
      "Comunidade de empresários",
      "Previsibilidade de faturamento"
    ],
    timeToResults: "Resultados visíveis a partir do 2º mês",
    idealProfile: [
      "Faturamento R$ 100k-400k/mês",
      "Já tem alguma estrutura comercial",
      "Precisa de cobrança externa",
      "Quer manter momentum"
    ],
    notFor: [
      "Quem não tem processo nenhum (precisa do Core antes)",
      "Quem busca transformação acelerada (precisa do Sales Acceleration)",
      "Quem não tem disciplina para executar"
    ]
  },
  "sales-acceleration": {
    id: "sales-acceleration",
    name: "UNV Sales Acceleration",
    tagline: "Aceleração Comercial Completa",
    icon: TrendingUp,
    color: "bg-accent",
    price: "R$ 24.000",
    priceType: "/ano",
    description: "Programa completo de 12 meses com direção, treinamento e cobrança integrados.",
    deliverables: [
      "Diagnóstico comercial completo",
      "Direção estratégica mensal + semanal",
      "Treinamento do time em 5 fases",
      "Estruturação completa de funil",
      "Scripts por fase do funil",
      "Metas e KPIs completos",
      "Avaliações por vendedor",
      "UNV AI Advisor nível máximo",
      "1 convite/ano Experiência Mansão"
    ],
    bestFor: "Empresas de R$ 150k a R$ 1M/mês com time comercial querendo acelerar resultados",
    whyRecommended: "Você tem time e está pronto para acelerar. O Sales Acceleration entrega direção + treinamento + cobrança em um só programa.",
    problemsSolved: [
      {
        problem: "Time comercial sem padronização — cada um vende de um jeito",
        solution: "Treinamento completo do time em 5 fases com scripts e processos",
        result: "Todo mundo vendendo no mesmo padrão, resultados previsíveis"
      },
      {
        problem: "Você, dono, ainda é o melhor vendedor — negócio depende de você",
        solution: "Estruturação completa de funil + avaliações individuais de cada vendedor",
        result: "Time vendendo igual ou melhor que você, liberdade para ser CEO"
      },
      {
        problem: "Não sabe quem do time está performando ou não",
        solution: "Metas e KPIs completos + avaliações periódicas por vendedor",
        result: "Clareza total de quem manter, quem desenvolver e quem substituir"
      },
      {
        problem: "Crescimento travado — faz mais esforço mas não vende mais",
        solution: "Direção estratégica mensal + semanal focada em destravar crescimento",
        result: "Crescimento real de 30-100% em 12 meses (dependendo de execução)"
      },
      {
        problem: "Não tem acesso a empresários do seu nível para trocar ideias",
        solution: "Experiência Mansão com outros empresários em crescimento",
        result: "Networking de alto nível + insights de quem passou pelo que você passa"
      }
    ],
    keyBenefits: [
      "Transformação comercial completa em 12 meses",
      "Time treinado e padronizado",
      "Métricas claras para gestão",
      "Dono livre do operacional de vendas",
      "Experiência Mansão inclusa"
    ],
    timeToResults: "Quick wins em 30 dias, transformação em 6-12 meses",
    idealProfile: [
      "Faturamento R$ 150k-1M/mês",
      "Time de 2-10 vendedores",
      "Quer acelerar crescimento",
      "Está pronto para investir em processo"
    ],
    notFor: [
      "Quem não tem time (precisa do Core)",
      "Quem só quer manter (precisa do Control)",
      "Quem não tem capacidade de investir R$ 2k/mês"
    ]
  },
  "growth-room": {
    id: "growth-room",
    name: "UNV Growth Room",
    tagline: "Imersão Presencial Estratégica",
    icon: MapPin,
    color: "bg-orange-500",
    price: "R$ 12.000",
    priceType: "por empresa",
    description: "Imersão presencial de 3 dias para clareza estratégica e plano de 90 dias.",
    deliverables: [
      "3 dias de imersão presencial",
      "Diagnóstico pré-imersão",
      "Direção estratégica intensiva",
      "Estruturação completa de funil",
      "Scripts e roteiros",
      "Plano de 90 dias",
      "Acompanhamento pós-imersão",
      "Treinamento intensivo"
    ],
    bestFor: "CEOs/donos de empresas R$ 150k a R$ 600k/mês que precisam parar e repensar a direção",
    whyRecommended: "Você precisa de clareza e direção. A Growth Room te tira do operacional para pensar estrategicamente.",
    problemsSolved: [
      {
        problem: "Cabeça tão no operacional que não consegue pensar estrategicamente",
        solution: "3 dias presenciais fora do ambiente de trabalho, 100% focado em estratégia",
        result: "Sai com clareza total do que fazer nos próximos 90 dias"
      },
      {
        problem: "Não sabe por onde começar para organizar o comercial",
        solution: "Diagnóstico pré-imersão + estruturação completa durante os 3 dias",
        result: "Funil estruturado, scripts prontos, prioridades definidas"
      },
      {
        problem: "Toma decisões sozinho, sem conselho ou segunda opinião qualificada",
        solution: "Direção estratégica intensiva com quem já passou por isso centenas de vezes",
        result: "Decisões mais seguras, menos erros caros"
      },
      {
        problem: "Volta de eventos/cursos motivado mas não implementa nada",
        solution: "Plano de 90 dias concreto + acompanhamento pós-imersão",
        result: "Implementação garantida, não fica só na motivação"
      }
    ],
    keyBenefits: [
      "Clareza estratégica em 3 dias",
      "Plano de 90 dias pronto",
      "Saída do operacional",
      "Implementação acompanhada"
    ],
    timeToResults: "Clareza imediata, resultados em 90 dias",
    idealProfile: [
      "Faturamento R$ 150k-600k/mês",
      "CEO/dono que vive no operacional",
      "Precisa de clareza estratégica",
      "Pode se ausentar 3 dias"
    ],
    notFor: [
      "Quem não pode parar 3 dias",
      "Quem só quer execução (precisa do Sales Acceleration)",
      "Quem já tem clareza estratégica"
    ]
  },
  partners: {
    id: "partners",
    name: "UNV Partners",
    tagline: "Direção Estratégica & Board Externo",
    icon: Crown,
    color: "bg-amber-500",
    price: "R$ 4.000",
    priceType: "/mês (12 meses)",
    description: "Fabrício como seu diretor comercial de fato, não como consultor.",
    deliverables: [
      "Board mensal de direção",
      "Acompanhamento semanal",
      "Cobrança de execução direta",
      "Direção individual recorrente",
      "Comunidade elite",
      "UNV AI Advisor estratégico",
      "Eventos exclusivos",
      "Experiência Mansão recorrente",
      "Benchmark com pares"
    ],
    bestFor: "Empresários de R$ 300k a R$ 2M/mês buscando parceria estratégica de decisão",
    whyRecommended: "Você já cresceu e precisa de um parceiro de decisão, não apenas orientação. O Partners te dá isso.",
    problemsSolved: [
      {
        problem: "Decisões estratégicas tomadas sozinho, sem conselho qualificado",
        solution: "Board mensal de direção + direção individual com quem já escalou dezenas de empresas",
        result: "Decisões mais assertivas, menos erros caros, crescimento mais rápido"
      },
      {
        problem: "Solidão do topo — não tem pares do seu nível para trocar",
        solution: "Comunidade elite de empresários do mesmo porte + Experiência Mansão recorrente",
        result: "Rede de confiança, benchmarks reais, insights de quem está no mesmo jogo"
      },
      {
        problem: "Time executa mas você não tem quem cobre você como dono",
        solution: "Cobrança de execução direta + acompanhamento semanal",
        result: "Accountability de verdade, impossível procrastinar decisões importantes"
      },
      {
        problem: "Cresceu mas não sabe qual próximo passo estratégico tomar",
        solution: "Direção estratégica recorrente focada no seu estágio específico",
        result: "Clareza do que priorizar em cada momento da empresa"
      }
    ],
    keyBenefits: [
      "Parceria estratégica de alto nível",
      "Rede de empresários elite",
      "Accountability do dono",
      "Experiência Mansão recorrente"
    ],
    timeToResults: "Impacto nas decisões imediato, resultados mensuráveis em 3-6 meses",
    idealProfile: [
      "Faturamento R$ 300k-2M/mês",
      "Busca parceiro de decisão",
      "Quer networking de alto nível",
      "Pode investir R$ 4k/mês"
    ],
    notFor: [
      "Quem busca só execução operacional",
      "Quem não está no nível de faturamento",
      "Quem quer solução rápida e barata"
    ]
  },
  "sales-ops": {
    id: "sales-ops",
    name: "UNV Sales Ops",
    tagline: "Padronização & Treinamento de Times",
    icon: Users2,
    color: "bg-violet-500",
    price: "R$ 2.500",
    priceType: "/ano",
    description: "Trilhas por cargo, onboarding e padronização de discurso para times comerciais.",
    deliverables: [
      "Trilhas por cargo (SDR, Closer, Gestor)",
      "Avaliações e scorecards",
      "Scripts por cargo",
      "Metas e KPIs por cargo",
      "Cobrança via trilhas",
      "UNV AI Advisor por cargo"
    ],
    bestFor: "Empresas R$ 200k+/mês com 5+ vendedores que perdem padrão quando alguém sai",
    whyRecommended: "Você tem time grande e precisa de padrão. O Sales Ops garante que todos sigam o mesmo método.",
    problemsSolved: [
      {
        problem: "Onboarding de vendedor novo demora meses e depende do gestor/dono",
        solution: "Trilhas por cargo com todo o conhecimento estruturado",
        result: "Vendedor novo produzindo em semanas, não em meses"
      },
      {
        problem: "Quando um vendedor bom sai, o conhecimento vai junto",
        solution: "Todo conhecimento documentado nas trilhas, não na cabeça das pessoas",
        result: "Empresa não perde performance quando troca pessoas"
      },
      {
        problem: "Cada vendedor faz de um jeito — não tem padrão",
        solution: "Scripts por cargo + avaliações padronizadas + scorecards",
        result: "Todo mundo no mesmo padrão, resultado previsível"
      },
      {
        problem: "Gestor não sabe como desenvolver cada vendedor",
        solution: "Avaliações individuais + trilhas de desenvolvimento específicas",
        result: "Caminho claro de evolução para cada pessoa do time"
      }
    ],
    keyBenefits: [
      "Onboarding acelerado",
      "Conhecimento documentado",
      "Padronização de discurso",
      "Desenvolvimento individual"
    ],
    timeToResults: "Impacto no onboarding imediato, padronização em 60-90 dias",
    idealProfile: [
      "Faturamento R$ 200k+/mês",
      "Time de 5+ vendedores",
      "Alta rotatividade ou crescimento",
      "Precisa de padronização"
    ],
    notFor: [
      "Times pequenos (menos de 5 pessoas)",
      "Quem não tem processo base (precisa do Core/Sales Acceleration primeiro)",
      "Quem busca direção estratégica (precisa do Partners)"
    ]
  },
  ads: {
    id: "ads",
    name: "UNV Ads",
    tagline: "Tráfego & Geração de Demanda",
    icon: Megaphone,
    color: "bg-green-500",
    price: "R$ 1.500 a R$ 4.000",
    priceType: "/mês + mídia",
    description: "Campanhas de tráfego pago integradas com vendas para gerar demanda qualificada.",
    deliverables: [
      "Gestão completa de tráfego",
      "Diagnóstico de demanda",
      "Estruturação de funil de aquisição",
      "Copies otimizadas",
      "Métricas CPL/CAC",
      "Otimização semanal",
      "Integração marketing/vendas",
      "Geração de leads qualificados"
    ],
    bestFor: "Empresas R$ 100k a R$ 1M+/mês com time comercial ativo precisando de mais leads",
    whyRecommended: "Você precisa de mais demanda qualificada. O Ads gera os leads, seu time converte.",
    problemsSolved: [
      {
        problem: "Poucos leads — time comercial ocioso esperando oportunidades",
        solution: "Campanhas de tráfego pago estruturadas para gerar volume qualificado",
        result: "Leads no volume certo para manter o time produtivo"
      },
      {
        problem: "Leads que chegam não têm qualidade — perda de tempo do time",
        solution: "Funil de aquisição estruturado + copies que qualificam antes de chegar",
        result: "Leads mais preparados, mais fáceis de converter"
      },
      {
        problem: "Marketing e vendas não conversam — desperdício de investimento",
        solution: "Integração completa marketing/vendas com métricas compartilhadas",
        result: "Todo real investido em mídia é rastreado até a venda"
      },
      {
        problem: "Não sabe quanto custa trazer um cliente — investe no escuro",
        solution: "Métricas CPL/CAC claras + otimização semanal baseada em dados",
        result: "Clareza total do ROI de cada canal, otimização contínua"
      }
    ],
    keyBenefits: [
      "Volume de leads qualificados",
      "Integração marketing/vendas",
      "Métricas claras de ROI",
      "Otimização contínua"
    ],
    timeToResults: "Primeiros leads em 7-14 dias, otimização em 60-90 dias",
    idealProfile: [
      "Faturamento R$ 100k-1M+/mês",
      "Time comercial ativo",
      "Precisa de mais leads",
      "Pode investir em mídia"
    ],
    notFor: [
      "Quem não tem time para atender leads",
      "Quem não tem capacidade de investir em mídia",
      "Quem não tem produto/serviço validado"
    ]
  },
  social: {
    id: "social",
    name: "UNV Social",
    tagline: "Social Media como Canal de Vendas",
    icon: MessageSquare,
    color: "bg-pink-500",
    price: "R$ 1.500 a R$ 3.500",
    priceType: "/mês",
    description: "Conteúdo estratégico para pré-venda, aquecimento e construção de autoridade.",
    deliverables: [
      "Estratégia de conteúdo completa",
      "Diagnóstico de posicionamento",
      "Conteúdo de pré-venda",
      "Construção de autoridade",
      "Integração marketing/vendas",
      "UNV AI Advisor Social"
    ],
    bestFor: "Empresas R$ 80k a R$ 1M+/mês onde a venda depende de confiança e autoridade do dono",
    whyRecommended: "Você precisa de autoridade no mercado. O Social constrói isso através de conteúdo estratégico.",
    problemsSolved: [
      {
        problem: "Cliente demora muito para fechar — ciclo de vendas longo demais",
        solution: "Conteúdo de pré-venda que educa e qualifica antes do time comercial",
        result: "Lead chega mais preparado, fecha mais rápido"
      },
      {
        problem: "Concorrente é lembrado antes de você — falta autoridade no mercado",
        solution: "Estratégia de construção de autoridade através de conteúdo posicionado",
        result: "Você vira referência no assunto, lead já chega querendo comprar de você"
      },
      {
        problem: "Redes sociais são custo, não trazem venda",
        solution: "Conteúdo estratégico focado em conversão, não em vaidade",
        result: "Social media que gera leads e prepara vendas"
      },
      {
        problem: "Não sabe o que postar — fica sem consistência",
        solution: "Estratégia de conteúdo completa + diagnóstico de posicionamento",
        result: "Calendário claro, conteúdo que faz sentido para o negócio"
      }
    ],
    keyBenefits: [
      "Construção de autoridade",
      "Redução do ciclo de vendas",
      "Conteúdo que gera leads",
      "Posicionamento claro"
    ],
    timeToResults: "Posicionamento em 30 dias, autoridade em 90-180 dias",
    idealProfile: [
      "Faturamento R$ 80k-1M+/mês",
      "Venda depende de confiança",
      "Quer construir autoridade",
      "Ciclo de vendas longo"
    ],
    notFor: [
      "Quem busca resultado rápido (Social é médio prazo)",
      "Quem não pode investir em conteúdo consistente",
      "Quem vende commodity (preço é único diferencial)"
    ]
  },
  leadership: {
    id: "leadership",
    name: "UNV Leadership",
    tagline: "Formação de Liderança",
    icon: Brain,
    color: "bg-cyan-500",
    price: "R$ 1.500",
    priceType: "/mês por líder ou R$ 15k/ano",
    description: "Programa de formação de líderes que sustentam pessoas, performance e crescimento.",
    deliverables: [
      "Diagnóstico de liderança",
      "PDI individual",
      "Formação em 4 dimensões",
      "Gestão de pessoas e performance",
      "Roteiros de feedback",
      "Rituais de cultura",
      "Avaliação contínua",
      "UNV AI Advisor Leadership",
      "Encontros híbridos"
    ],
    bestFor: "Empresas R$ 100k a R$ 2M+/mês com líderes intermediários que não cobram ou desenvolvem",
    whyRecommended: "Seu gargalo são os líderes. O Leadership forma gestores que sustentam crescimento sem depender de você.",
    problemsSolved: [
      {
        problem: "Líderes não cobram resultado — você, dono, ainda precisa cobrar",
        solution: "Formação em gestão de performance com roteiros de feedback",
        result: "Líderes que cobram e desenvolvem, você livre do operacional"
      },
      {
        problem: "Promoveu bons técnicos que viraram péssimos gestores",
        solution: "PDI individual + formação em 4 dimensões de liderança",
        result: "Transformação de técnicos em gestores de verdade"
      },
      {
        problem: "Cultura depende de você — quando você não está, tudo desanda",
        solution: "Rituais de cultura + formação de líderes como guardiões da cultura",
        result: "Cultura sustentada pelos líderes, não só pelo dono"
      },
      {
        problem: "Alta rotatividade porque líderes não sabem reter pessoas",
        solution: "Gestão de pessoas + desenvolvimento de habilidades de retenção",
        result: "Times mais estáveis, menos turnover, menos custo"
      }
    ],
    keyBenefits: [
      "Líderes que cobram resultado",
      "Cultura independente do dono",
      "Redução de turnover",
      "Gestores de verdade"
    ],
    timeToResults: "Primeiras mudanças em 30-60 dias, transformação em 6 meses",
    idealProfile: [
      "Faturamento R$ 100k-2M+/mês",
      "Líderes intermediários fracos",
      "Cultura depende do dono",
      "Alta rotatividade"
    ],
    notFor: [
      "Quem não tem líderes intermediários",
      "Quem busca só treinamento pontual",
      "Quem não vai dar tempo para líderes se desenvolverem"
    ]
  },
  mastermind: {
    id: "mastermind",
    name: "UNV Mastermind",
    tagline: "Inner Circle de Líderes",
    icon: Star,
    color: "bg-amber-500",
    price: "R$ 50.000",
    priceType: "/ano",
    description: "Grupo ultra seletivo com hot seats mensais e Mansão Empresarial.",
    deliverables: [
      "Sessões de hot seat mensais",
      "Mansão Empresarial mensal",
      "Board coletivo de decisão",
      "Direção individual 2x/ano",
      "Comunidade ultra seletiva",
      "UNV AI Advisor Mastermind"
    ],
    bestFor: "Empresários R$ 1M a R$ 10M/mês que já cresceram e querem decidir melhor com pares à altura",
    whyRecommended: "Você já passou da fase de execução. Agora precisa de um conselho de decisão com pares do seu nível.",
    problemsSolved: [
      {
        problem: "Decisões estratégicas complexas sem conselho qualificado",
        solution: "Hot seats mensais onde seu problema é analisado por empresários do mesmo nível",
        result: "Decisões mais seguras com perspectivas de quem já passou pelo mesmo"
      },
      {
        problem: "Solidão extrema do topo — não tem com quem ser vulnerável",
        solution: "Mansão Empresarial mensal em ambiente confidencial e de alta confiança",
        result: "Espaço seguro para falar sobre problemas reais sem julgamento"
      },
      {
        problem: "Rede de contatos não te desafia — só bajulação",
        solution: "Comunidade ultra seletiva de empresários que te confrontam com honestidade",
        result: "Feedback real, não o que você quer ouvir"
      },
      {
        problem: "Cresceu mas sente que poderia estar num patamar muito maior",
        solution: "Board coletivo de decisão + direção individual focada em próximo nível",
        result: "Clareza do caminho para dobrar/triplicar o tamanho atual"
      }
    ],
    keyBenefits: [
      "Conselho de decisão com pares",
      "Ambiente confidencial premium",
      "Confrontação honesta",
      "Clareza estratégica de próximo nível"
    ],
    timeToResults: "Impacto nas decisões imediato, transformação em 12 meses",
    idealProfile: [
      "Faturamento R$ 1M-10M/mês",
      "Já cresceu e busca próximo nível",
      "Quer pares à altura",
      "Pode investir R$ 50k/ano"
    ],
    notFor: [
      "Quem busca execução operacional",
      "Quem não está no nível de faturamento",
      "Quem não quer ser confrontado"
    ]
  },
  "sales-force": {
    id: "sales-force",
    name: "UNV Sales Force",
    tagline: "Operação Comercial Terceirizada",
    icon: Zap,
    color: "bg-red-500",
    price: "R$ 6.000",
    priceType: "/mês + comissão",
    description: "UNV opera como SDR e/ou Closer da sua empresa — execução, não só direção.",
    deliverables: [
      "SDR e/ou Closer operando diretamente",
      "Adaptação de scripts à operação",
      "Definição de métricas de performance",
      "Execução diária de prospecção/fechamento",
      "Ajustes semanais de abordagem",
      "Report mensal completo"
    ],
    bestFor: "Empresas R$ 100k-1M+/mês com leads mas sem capacidade de conversão",
    whyRecommended: "Você tem demanda mas não tem capacidade de converter. O Sales Force executa por você.",
    problemsSolved: [
      {
        problem: "Leads chegam mas ninguém converte — desperdício de demanda",
        solution: "Closer experiente operando diretamente no fechamento",
        result: "Leads sendo convertidos, receita que estava na mesa sendo capturada"
      },
      {
        problem: "Não consegue contratar vendedor bom — turnover alto ou baixa performance",
        solution: "Operação terceirizada com profissionais já treinados e experientes",
        result: "Performance imediata sem custo de recrutamento e treinamento"
      },
      {
        problem: "Precisa vender mais rápido mas não tem tempo de montar time",
        solution: "Operação pronta para rodar em semanas, não meses",
        result: "Capacidade comercial imediata enquanto estrutura time próprio"
      },
      {
        problem: "Já tentou ter time mas não consegue gerenciar vendas",
        solution: "Gestão completa da operação — você só acompanha resultados",
        result: "Vende mais sem se preocupar com gestão de time comercial"
      }
    ],
    keyBenefits: [
      "Execução imediata",
      "Sem custo de contratação",
      "Profissionais experientes",
      "Gestão inclusa"
    ],
    timeToResults: "Operação rodando em 2-3 semanas, resultados em 30-60 dias",
    idealProfile: [
      "Faturamento R$ 100k-1M+/mês",
      "200+ leads/mês comprovados",
      "Investimento mínimo R$ 2k/mês em tráfego",
      "Oferta validada"
    ],
    notFor: [
      "Quem não tem leads (precisa do Ads primeiro)",
      "Quem não tem oferta validada",
      "Quem quer só direção (precisa do Sales Acceleration)"
    ]
  },
  "le-desir": {
    id: "le-desir",
    name: "Le Désir",
    tagline: "Análise Estratégica para Líderes",
    icon: Heart,
    color: "bg-rose-500",
    price: "R$ 1.200 a R$ 2.000",
    priceType: "/mês",
    description: "Análise estratégica individual para líderes enfrentando o peso emocional da liderança.",
    deliverables: [
      "Sessões individuais semanais ou quinzenais",
      "Ambiente 100% confidencial",
      "Análise de padrões de decisão",
      "Suporte emocional de liderança",
      "Processo analítico sem agenda fixa"
    ],
    bestFor: "CEOs, fundadores e executivos enfrentando exaustão mental e solidão da liderança",
    whyRecommended: "Você carrega o peso sozinho. Le Désir oferece espaço para processar o que não cabe em lugar nenhum.",
    problemsSolved: [
      {
        problem: "Exaustão mental — sente que está sempre no limite",
        solution: "Sessões regulares para processar peso emocional da liderança",
        result: "Clareza mental, decisões mais equilibradas, menos estresse"
      },
      {
        problem: "Padrões destrutivos que se repetem — mesmos erros, diferentes cenários",
        solution: "Análise de padrões de comportamento e decisão",
        result: "Consciência dos padrões, capacidade de mudar"
      },
      {
        problem: "Solidão extrema — não tem com quem ser vulnerável de verdade",
        solution: "Ambiente 100% confidencial sem julgamento",
        result: "Espaço seguro para falar sobre tudo que não pode falar em lugar nenhum"
      },
      {
        problem: "Decisões reativas em vez de estratégicas — age pelo impulso",
        solution: "Processo analítico que desenvolve autoconhecimento",
        result: "Decisões mais conscientes, menos reação emocional"
      }
    ],
    keyBenefits: [
      "Clareza mental",
      "Espaço confidencial",
      "Autoconhecimento",
      "Decisões mais equilibradas"
    ],
    timeToResults: "Alívio imediato, transformação em 6-12 meses",
    idealProfile: [
      "CEO, fundador ou executivo de alto nível",
      "Sentindo peso da liderança",
      "Padrões que se repetem",
      "Busca autoconhecimento"
    ],
    notFor: [
      "Quem busca terapia clínica (não é tratamento)",
      "Quem quer soluções operacionais",
      "Quem não está aberto ao processo"
    ]
  },
  finance: {
    id: "finance",
    name: "UNV Finance",
    tagline: "Controle Financeiro Estratégico",
    icon: DollarSign,
    color: "bg-emerald-600",
    price: "R$ 3.000",
    priceType: "/mês",
    description: "Clareza financeira para tomar decisões de crescimento com segurança.",
    deliverables: [
      "Estruturação financeira completa",
      "DRE gerencial mensal",
      "Controle de fluxo de caixa",
      "Análise de margem por produto",
      "Suporte em decisões financeiras",
      "Projeção de caixa 90 dias"
    ],
    bestFor: "Empresas R$ 100k-2M+/mês que faturam bem mas não sabem onde o dinheiro vai",
    whyRecommended: "Você cresce mas não entende suas finanças. O Finance traz clareza para decidir com segurança.",
    problemsSolved: [
      {
        problem: "Fatura bem mas não sobra dinheiro — não sabe para onde vai",
        solution: "Estruturação financeira + DRE gerencial que mostra exatamente onde cada real vai",
        result: "Clareza total de receitas, custos e onde está o vazamento"
      },
      {
        problem: "Não sabe qual produto/serviço dá mais margem",
        solution: "Análise de margem por produto/serviço detalhada",
        result: "Sabe exatamente o que priorizar para maximizar lucro"
      },
      {
        problem: "Decisões de investimento no escuro — medo de investir sem clareza",
        solution: "Projeção de caixa 90 dias + suporte em decisões financeiras",
        result: "Investe com segurança, sabe quando pode e quando não pode"
      },
      {
        problem: "Estresse financeiro constante — não sabe se vai fechar o mês",
        solution: "Controle de fluxo de caixa + visibilidade futura",
        result: "Tranquilidade financeira, sabe exatamente a situação"
      }
    ],
    keyBenefits: [
      "Clareza financeira total",
      "Decisões de investimento seguras",
      "Margem por produto clara",
      "Projeção de caixa"
    ],
    timeToResults: "Clareza em 30 dias, controle total em 90 dias",
    idealProfile: [
      "Faturamento R$ 100k-2M+/mês",
      "Sem clareza financeira",
      "Quer investir mas tem medo",
      "Cresce mas não sobra dinheiro"
    ],
    notFor: [
      "Quem busca contabilidade (não é contabilidade)",
      "Quem tem CFO estruturado",
      "Quem não quer ver a realidade dos números"
    ]
  },
  people: {
    id: "people",
    name: "UNV People",
    tagline: "Gestão Estratégica de Pessoas",
    icon: Users,
    color: "bg-indigo-500",
    price: "R$ 2.500 a R$ 8.000",
    priceType: "/mês",
    description: "Estruturação de pessoas desde contratação até desenvolvimento para escalar sem gargalo de time.",
    deliverables: [
      "Diagnóstico de vagas e perfis",
      "Processo de contratação estruturado",
      "Triagem e entrevistas",
      "Onboarding 30-60-90",
      "Avaliação de performance",
      "Desenvolvimento de líderes",
      "Indicadores de pessoas"
    ],
    bestFor: "Empresas R$ 100k-2M+/mês com rotatividade ou dificuldade de contratar certo",
    whyRecommended: "Pessoas são seu gargalo. O People estrutura contratação e desenvolvimento para escalar.",
    problemsSolved: [
      {
        problem: "Contrata errado — demora meses para descobrir que a pessoa não serve",
        solution: "Processo de contratação estruturado com perfil definido e triagem rigorosa",
        result: "Contrata certo da primeira vez, menos turnover"
      },
      {
        problem: "Vendedor novo demora muito para produzir — onboarding inexistente",
        solution: "Onboarding estruturado 30-60-90 com marcos claros de evolução",
        result: "Novo funcionário produzindo em semanas, não meses"
      },
      {
        problem: "Não sabe quem está performando ou não — avaliação na intuição",
        solution: "Avaliação de performance estruturada com indicadores claros",
        result: "Sabe exatamente quem manter, desenvolver ou substituir"
      },
      {
        problem: "Rotatividade alta — gasta mais tempo repondo do que crescendo",
        solution: "Indicadores de pessoas + desenvolvimento que retém talentos",
        result: "Times estáveis, menos custo de turnover"
      }
    ],
    keyBenefits: [
      "Contratação assertiva",
      "Onboarding acelerado",
      "Avaliação de performance",
      "Redução de turnover"
    ],
    timeToResults: "Primeira contratação certa em 30 dias, estrutura em 90 dias",
    idealProfile: [
      "Faturamento R$ 100k-2M+/mês",
      "Alta rotatividade",
      "Dificuldade de contratar",
      "Precisa escalar time"
    ],
    notFor: [
      "Quem não tem gargalo de pessoas",
      "Quem busca só recrutamento pontual (temos modalidade Hiring)",
      "Quem não quer investir em estrutura"
    ]
  }
};

export const getProductById = (id: string): ProductDetail | undefined => {
  return productDetails[id];
};

export const getAllProducts = (): ProductDetail[] => {
  return Object.values(productDetails);
};
