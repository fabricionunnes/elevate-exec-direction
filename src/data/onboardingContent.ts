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
const slides: OnboardingSlide[] = [
    // Slide 1: Introduction
    {
      title: `Bem-vindo ao ${product.name}`,
      content: [
        product.tagline,
        product.description,
      ],
      type: "intro",
    },
    // Slide 2: What you will receive
    {
      title: "O que você vai receber",
      content: product.deliverables,
      type: "deliverable",
    },
    // Slide 3: Problems we solve
    {
      title: "Problemas que resolvemos",
      content: product.problemsSolved.map((ps) => `${ps.problem} → ${ps.result}`),
      type: "deliverable",
    },
    // Slide 4: Key Benefits
    {
      title: "Benefícios-chave",
      content: product.keyBenefits,
      type: "deliverable",
    },
    // Slide 5: Time to results
    {
      title: "Expectativas e Tempo de Resultado",
      content: [
        product.timeToResults,
        product.bestFor,
        product.whyRecommended,
      ],
      type: "expectations",
    },
    // Slide 6: Next steps
    {
      title: "Próximos Passos",
      content: [
        "Alinhar expectativas com o cliente",
        "Definir data de início",
        "Configurar acesso às ferramentas",
        "Agendar primeira reunião de kick-off",
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
