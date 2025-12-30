import { productDetails, ProductDetail } from "./productDetails";

export interface OnboardingSlideItem {
  text: string;
  details?: string;
}

export interface OnboardingSlide {
  title: string;
  content: OnboardingSlideItem[];
  type: "intro" | "deliverable" | "cadence" | "expectations" | "next-steps";
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
    // Slide 1: Introduction
    {
      title: `Bem-vindo ao ${product.name}`,
      content: [
        { text: product.tagline },
        { text: transformToSecondPerson(product.description) },
      ],
      type: "intro",
    },
    // Slide 2: What you will receive
    {
      title: "O que você vai receber",
      content: product.deliverables.map((d) => ({
        text: transformToSecondPerson(d),
        details: findDetails(d),
      })),
      type: "deliverable",
    },
    // Slide 3: Problems we solve - with solution as details
    {
      title: "Problemas que vamos resolver juntos",
      content: product.problemsSolved.map((ps) => ({
        text: `${transformToSecondPerson(ps.problem)} → ${transformToSecondPerson(ps.result)}`,
        details: transformToSecondPerson(ps.solution),
      })),
      type: "deliverable",
    },
    // Slide 4: Key Benefits
    {
      title: "Benefícios que você terá",
      content: product.keyBenefits.map((b) => ({
        text: transformToSecondPerson(b),
      })),
      type: "deliverable",
    },
    // Slide 5: Time to results
    {
      title: "O que esperar e quando",
      content: [
        { text: transformToSecondPerson(product.timeToResults) },
        { text: transformToSecondPerson(product.whyRecommended) },
      ],
      type: "expectations",
    },
    // Slide 6: Next steps
    {
      title: "Seus Próximos Passos",
      content: [
        { 
          text: "Vamos alinhar as expectativas juntos",
          details: "Nessa conversa, vamos garantir que você entenda exatamente o que vai receber e como vamos trabalhar juntos."
        },
        { 
          text: "Definir a data de início do seu programa",
          details: "Escolhemos juntos a melhor data para começar, considerando sua disponibilidade e momento atual."
        },
        { 
          text: "Configurar seus acessos às ferramentas",
          details: "Você receberá acesso a todas as ferramentas necessárias: plataforma, grupos, materiais e AI Advisor."
        },
        { 
          text: "Agendar nossa primeira reunião de kick-off",
          details: "Na reunião de kick-off, vamos dar o pontapé inicial do programa com seu diagnóstico e primeiros passos."
        },
      ],
      type: "next-steps",
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
