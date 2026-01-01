import { productDetails, ProductDetail } from "./productDetails";

export interface OnboardingSlideItem {
  text: string;
  details?: string;
}

export interface PresenterNote {
  tip: string;
  talkingPoints?: string[];
  watchOut?: string;
}

export interface OnboardingSlide {
  title: string;
  content: OnboardingSlideItem[];
  type: "intro" | "deliverable" | "cadence" | "expectations" | "next-steps";
  presenterNotes?: PresenterNote;
}

export interface ProductOnboarding {
  productId: string;
  productName: string;
  tagline: string;
  slides: OnboardingSlide[];
}

// Deliverable details mapping - explains each deliverable in more depth
const deliverableDetails: Record<string, Record<string, string>> = {
  // Generic details that apply to common deliverables
  generic: {
    "Diagnóstico comercial": "Análise completa da sua operação comercial atual, identificando gaps, oportunidades e pontos de melhoria prioritários.",
    "Estruturação de funil": "Definição clara das etapas do seu funil de vendas, com critérios de passagem entre fases e métricas de acompanhamento.",
    "Scripts": "Roteiros testados e validados para cada momento da venda, desde a abordagem inicial até o fechamento.",
    "Metas": "Definição de metas realistas baseadas na sua capacidade atual, com desdobramento por período e por pessoa.",
    "KPIs": "Indicadores-chave que você vai acompanhar para medir a saúde da sua operação comercial.",
    "Treinamento": "Capacitação prática do seu time com metodologia UNV, focada em execução imediata.",
    "Acompanhamento": "Reuniões periódicas para revisar resultados, ajustar rotas e garantir execução.",
    "Cobrança": "Rituais de accountability para garantir que o combinado seja executado.",
    "AI Advisor": "Acesso ao assistente de IA da UNV para tirar dúvidas e receber orientações a qualquer momento.",
    "Comunidade": "Acesso à rede de empresários UNV para networking e troca de experiências.",
    "Avaliações": "Análise individual de cada membro do time com feedback estruturado.",
    "Board": "Reunião estratégica de alto nível para tomada de decisões importantes.",
    "Direção": "Orientação estratégica sobre o que fazer e como fazer, com clareza de prioridades.",
    "CRM": "Sistema de gestão de relacionamento com clientes configurado para sua operação.",
    "Reunião diária": "Daily de 15-30 minutos para alinhar o dia, revisar pipeline e destravar impedimentos.",
    "Reunião semanal": "Encontro semanal para análise de resultados e planejamento da semana seguinte.",
    "Reunião mensal": "Fechamento do mês com análise de indicadores e definição de prioridades.",
  },
};

// Generate onboarding slides for each product
export const generateOnboardingSlides = (product: ProductDetail): ProductOnboarding => {
  // Transform content to speak directly to the client (second person)
  const transformToSecondPerson = (text: string): string => {
    return text
      .replace(/o cliente/gi, "você")
      .replace(/do cliente/gi, "seu")
      .replace(/ao cliente/gi, "a você")
      .replace(/para o cliente/gi, "para você")
      .replace(/seu time/gi, "seu time")
      .replace(/sua empresa/gi, "sua empresa");
  };

  // Find matching details for a deliverable
  const findDetails = (deliverable: string): string | undefined => {
    const lowerDeliverable = deliverable.toLowerCase();
    for (const [key, value] of Object.entries(deliverableDetails.generic)) {
      if (lowerDeliverable.includes(key.toLowerCase())) {
        return value;
      }
    }
    return undefined;
  };

  const slides: OnboardingSlide[] = [
    // Slide 1: Introduction - Energetic welcome
    {
      title: `Que bom ter você aqui! 🙌`,
      content: [
        { text: `Você está entrando no ${product.name} – e a gente tá animado com isso!` },
        { text: transformToSecondPerson(product.description) },
        { text: "A partir de agora, você não está mais sozinho nessa jornada." },
      ],
      type: "intro",
      presenterNotes: {
        tip: "Crie conexão! Sorria, olhe nos olhos e demonstre entusiasmo genuíno.",
        talkingPoints: [
          "Pergunte como foi o processo de decisão até aqui",
          "Valide a escolha: 'Você tomou a decisão certa'",
          "Mencione um case de sucesso similar se tiver",
        ],
        watchOut: "Evite parecer roteiro decorado. Adapte ao contexto do cliente.",
      },
    },
    // Slide 2: What you will receive - Gift framing
    {
      title: "Olha o que preparamos pra você! 🎁",
      content: product.deliverables.map((d, i) => ({
        text: `${transformToSecondPerson(d)}${i === 0 ? " – isso é só o começo!" : ""}`,
        details: findDetails(d),
      })),
      type: "deliverable",
      presenterNotes: {
        tip: "Destaque 2-3 entregáveis mais relevantes pro perfil desse cliente.",
        talkingPoints: [
          "Qual desses é mais urgente pra você?",
          "Já tentou fazer algum desses antes?",
          "Explore as dores específicas ligadas a cada item",
        ],
        watchOut: "Não passe rápido demais. Deixe o cliente absorver o valor.",
      },
    },
    // Slide 3: Problems we solve - Transformation focus
    {
      title: "Adeus, dor de cabeça! 👋",
      content: product.problemsSolved.map((ps) => ({
        text: `De "${transformToSecondPerson(ps.problem)}" para "${transformToSecondPerson(ps.result)}"`,
        details: transformToSecondPerson(ps.solution),
      })),
      type: "deliverable",
      presenterNotes: {
        tip: "Faça o cliente se ver no 'antes' e desejar o 'depois'.",
        talkingPoints: [
          "Qual dessas situações você mais se identifica?",
          "Como isso afeta o dia a dia da empresa?",
          "O que mudaria se isso fosse resolvido?",
        ],
        watchOut: "Não minimize as dores. Valide antes de apresentar a transformação.",
      },
    },
    // Slide 4: Key Benefits - Celebration
    {
      title: "O que você vai conquistar! 🏆",
      content: product.keyBenefits.map((b) => ({
        text: transformToSecondPerson(b),
      })),
      type: "deliverable",
      presenterNotes: {
        tip: "Este é o momento de criar expectativa positiva e confiança.",
        talkingPoints: [
          "Imagine quando isso acontecer...",
          "Outros clientes como você já alcançaram...",
          "Vamos comemorar cada conquista juntos!",
        ],
        watchOut: "Não prometa garantias. Use 'projeção' e 'potencial'.",
      },
    },
    // Slide 5: Time to results - Exciting expectations
    {
      title: "Quando você vai ver resultado? 📈",
      content: [
        { text: `${transformToSecondPerson(product.timeToResults)} – e a gente vai comemorar junto!` },
        { text: transformToSecondPerson(product.whyRecommended) },
        { text: "Lembra: a gente tá nessa contigo, passo a passo." },
      ],
      type: "expectations",
      presenterNotes: {
        tip: "Alinhe expectativas realistas. Melhor surpreender do que decepcionar.",
        talkingPoints: [
          "Os primeiros sinais aparecem em X semanas",
          "O esforço inicial é maior, depois normaliza",
          "Pergunte: você consegue se comprometer com isso?",
        ],
        watchOut: "Não crie falsas expectativas de resultado garantido.",
      },
    },
    // Slide 6: Next steps - Partnership closing
    {
      title: "Bora começar? 🚀",
      content: [
        { 
          text: "Primeiro, vamos alinhar tudo direitinho",
          details: "Queremos ter certeza que você entende exatamente o que vai receber. Sem surpresas, só resultados!"
        },
        { 
          text: "Depois, escolhemos juntos a data perfeita pra começar",
          details: "A gente vai encontrar o momento ideal pra você, respeitando sua agenda."
        },
        { 
          text: "Você vai receber todos os acessos e ferramentas",
          details: "Plataforma, grupos, materiais, AI Advisor – tudo configurado e pronto pra você usar."
        },
        { 
          text: "E aí... é só decolar! 🛫",
          details: "No kick-off, a gente faz seu diagnóstico e define os primeiros passos juntos. Vai ser incrível!"
        },
      ],
      type: "next-steps",
      presenterNotes: {
        tip: "Feche com energia! Deixe o cliente ansioso pra começar.",
        talkingPoints: [
          "Tem alguma dúvida antes de seguirmos?",
          "Qual data funciona melhor pra você?",
          "Anote os próximos passos junto com o cliente",
        ],
        watchOut: "Garanta que o cliente saiu sem dúvidas. Pergunte diretamente.",
      },
    },
  ];

  return {
    productId: product.id,
    productName: product.name,
    tagline: product.tagline,
    slides,
  };
};

// Get all product onboardings
export const getAllProductOnboardings = (): ProductOnboarding[] => {
  return Object.values(productDetails).map((product) => generateOnboardingSlides(product));
};

// Get onboarding by product ID
export const getOnboardingByProductId = (productId: string): ProductOnboarding | undefined => {
  const product = productDetails[productId];
  if (!product) return undefined;
  return generateOnboardingSlides(product);
};

// Product categories for better organization
export const productCategories = {
  "trilha-principal": {
    name: "Trilha Principal",
    products: ["core", "control", "sales-acceleration"],
  },
  "operacao-comercial": {
    name: "Operação Comercial",
    products: ["sales-ops", "sales-force", "fractional-cro", "ai-sales-system"],
  },
  "trilha-avancada": {
    name: "Trilha Avançada",
    products: ["growth-room", "partners", "mastermind", "execution-partnership"],
  },
  "estrategia-estrutura": {
    name: "Estratégia & Estrutura",
    products: ["finance", "people", "leadership", "safe"],
  },
  outros: {
    name: "Outros",
    products: ["ads", "social", "le-desir"],
  },
};
