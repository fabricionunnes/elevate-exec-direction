import { productDetails, ProductDetail } from "./productDetails";

export interface OnboardingSlide {
  title: string;
  content: string[];
  type: "intro" | "deliverable" | "cadence" | "expectations" | "next-steps";
}

export interface ProductOnboarding {
  productId: string;
  productName: string;
  tagline: string;
  slides: OnboardingSlide[];
}

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

  const slides: OnboardingSlide[] = [
    // Slide 1: Introduction
    {
      title: `Bem-vindo ao ${product.name}`,
      content: [
        product.tagline,
        transformToSecondPerson(product.description),
      ],
      type: "intro",
    },
    // Slide 2: What you will receive
    {
      title: "O que você vai receber",
      content: product.deliverables.map(transformToSecondPerson),
      type: "deliverable",
    },
    // Slide 3: Problems we solve
    {
      title: "Problemas que vamos resolver juntos",
      content: product.problemsSolved.map((ps) => 
        `${transformToSecondPerson(ps.problem)} → ${transformToSecondPerson(ps.result)}`
      ),
      type: "deliverable",
    },
    // Slide 4: Key Benefits
    {
      title: "Benefícios que você terá",
      content: product.keyBenefits.map(transformToSecondPerson),
      type: "deliverable",
    },
    // Slide 5: Time to results
    {
      title: "O que esperar e quando",
      content: [
        transformToSecondPerson(product.timeToResults),
        transformToSecondPerson(product.whyRecommended),
      ],
      type: "expectations",
    },
    // Slide 6: Next steps
    {
      title: "Seus Próximos Passos",
      content: [
        "Vamos alinhar as expectativas juntos",
        "Definir a data de início do seu programa",
        "Configurar seus acessos às ferramentas",
        "Agendar nossa primeira reunião de kick-off",
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
