import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  XCircle,
  Layers,
  RefreshCw,
  TrendingUp,
  MapPin,
  Crown,
  Users2,
  BarChart3,
  Calendar,
  MessageSquare,
  Sparkles,
  Home,
  FileText,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  icp: string;
  revenue: string;
  team: string;
  price: string;
  priceType: string;
  link: string;
}

const products: Product[] = [
  {
    id: "core",
    name: "UNV Core",
    tagline: "Fundação Comercial",
    icon: Layers,
    color: "bg-blue-500",
    icp: "Empresas iniciando estruturação",
    revenue: "R$ 50k–150k/mês",
    team: "1–5 vendedores",
    price: "R$ 997 – R$ 1.997",
    priceType: "único",
    link: "/core"
  },
  {
    id: "control",
    name: "UNV Control",
    tagline: "Direção Recorrente",
    icon: RefreshCw,
    color: "bg-emerald-500",
    icp: "Empresas que precisam de constância",
    revenue: "R$ 100k–400k/mês",
    team: "Qualquer tamanho",
    price: "R$ 297 – R$ 597",
    priceType: "/mês",
    link: "/control"
  },
  {
    id: "sales-acceleration",
    name: "UNV Sales Acceleration",
    tagline: "Programa Principal",
    icon: TrendingUp,
    color: "bg-accent",
    icp: "Empresas prontas para acelerar",
    revenue: "R$ 150k–1M/mês",
    team: "3–20 vendedores",
    price: "R$ 24k – R$ 36k",
    priceType: "/ano",
    link: "/sales-acceleration"
  },
  {
    id: "growth-room",
    name: "UNV Growth Room",
    tagline: "Imersão Presencial",
    icon: MapPin,
    color: "bg-orange-500",
    icp: "Empresas que precisam de virada rápida",
    revenue: "R$ 150k–600k/mês",
    team: "Qualquer tamanho",
    price: "R$ 12k – R$ 20k",
    priceType: "único",
    link: "/growth-room"
  },
  {
    id: "partners",
    name: "UNV Partners",
    tagline: "Elite Estratégico",
    icon: Crown,
    color: "bg-amber-500",
    icp: "Empresas estabelecidas buscando board",
    revenue: "R$ 300k–2M/mês",
    team: "Qualquer tamanho",
    price: "R$ 3k – R$ 6k",
    priceType: "/mês",
    link: "/partners"
  },
  {
    id: "sales-ops",
    name: "UNV Sales Ops",
    tagline: "Padronização de Times",
    icon: Users2,
    color: "bg-violet-500",
    icp: "Empresas com times grandes",
    revenue: "R$ 200k+/mês",
    team: "5+ vendedores",
    price: "R$ 97 – R$ 297",
    priceType: "/usuário/mês",
    link: "/sales-ops"
  }
];

interface Feature {
  name: string;
  description: string;
  category: string;
  products: Record<string, boolean | string>;
}

const features: Feature[] = [
  // Direção
  {
    name: "Direção Estratégica",
    description: "Definição de prioridades e rumo comercial",
    category: "Direção",
    products: {
      core: false,
      control: "Mensal",
      "sales-acceleration": "Mensal + Semanal",
      "growth-room": "3 dias intensivos",
      partners: "Board mensal",
      "sales-ops": false
    }
  },
  {
    name: "Acompanhamento Semanal",
    description: "Check-ins semanais de execução",
    category: "Direção",
    products: {
      core: false,
      control: "Via AI",
      "sales-acceleration": true,
      "growth-room": "Pós-imersão",
      partners: true,
      "sales-ops": false
    }
  },
  {
    name: "Cobrança de Execução",
    description: "Responsabilização ativa do time",
    category: "Direção",
    products: {
      core: "Básica",
      control: true,
      "sales-acceleration": true,
      "growth-room": "90 dias",
      partners: true,
      "sales-ops": "Via trilhas"
    }
  },
  // Estrutura
  {
    name: "Diagnóstico Comercial",
    description: "Análise profunda da operação",
    category: "Estrutura",
    products: {
      core: "Direcional",
      control: false,
      "sales-acceleration": "Completo",
      "growth-room": "Pré-imersão",
      partners: false,
      "sales-ops": false
    }
  },
  {
    name: "Estruturação de Funil",
    description: "Definição de etapas e critérios",
    category: "Estrutura",
    products: {
      core: "Básico",
      control: false,
      "sales-acceleration": "Completo",
      "growth-room": "Completo",
      partners: false,
      "sales-ops": false
    }
  },
  {
    name: "Scripts e Roteiros",
    description: "Padronização de discurso",
    category: "Estrutura",
    products: {
      core: "Essenciais",
      control: "Templates",
      "sales-acceleration": "Por fase",
      "growth-room": true,
      partners: false,
      "sales-ops": "Por cargo"
    }
  },
  {
    name: "Metas e KPIs",
    description: "Definição de indicadores",
    category: "Estrutura",
    products: {
      core: "Básicas",
      control: false,
      "sales-acceleration": "Completas",
      "growth-room": true,
      partners: false,
      "sales-ops": "Por cargo"
    }
  },
  // Treinamento
  {
    name: "Treinamento do Time",
    description: "Capacitação dos vendedores",
    category: "Treinamento",
    products: {
      core: false,
      control: false,
      "sales-acceleration": "5 fases",
      "growth-room": "3 dias",
      partners: false,
      "sales-ops": "Trilhas por cargo"
    }
  },
  {
    name: "Trilhas por Cargo",
    description: "SDR, Closer, Gestor",
    category: "Treinamento",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": true
    }
  },
  {
    name: "Avaliações e Scorecards",
    description: "Medição de performance individual",
    category: "Treinamento",
    products: {
      core: false,
      control: false,
      "sales-acceleration": "Por vendedor",
      "growth-room": false,
      partners: false,
      "sales-ops": true
    }
  },
  // Suporte
  {
    name: "UNV AI Advisor",
    description: "Suporte via inteligência artificial",
    category: "Suporte",
    products: {
      core: "Básico",
      control: "Execução",
      "sales-acceleration": "Máximo",
      "growth-room": "Configurado",
      partners: "Estratégico",
      "sales-ops": "Por cargo"
    }
  },
  {
    name: "Comunidade",
    description: "Acesso a grupo de empresários",
    category: "Suporte",
    products: {
      core: false,
      control: true,
      "sales-acceleration": false,
      "growth-room": false,
      partners: "Elite",
      "sales-ops": false
    }
  },
  // Experiências
  {
    name: "Encontros Presenciais",
    description: "Sessões ao vivo",
    category: "Experiências",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": "3 dias",
      partners: "Eventos exclusivos",
      "sales-ops": false
    }
  },
  {
    name: "Experiência Mansão",
    description: "Networking de elite",
    category: "Experiências",
    products: {
      core: false,
      control: false,
      "sales-acceleration": "1 convite/ano",
      "growth-room": false,
      partners: "Recorrente",
      "sales-ops": false
    }
  },
  {
    name: "Benchmark com Pares",
    description: "Comparativo com outras empresas",
    category: "Experiências",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: true,
      "sales-ops": false
    }
  }
];

const categories = [...new Set(features.map(f => f.category))];

export default function ComparePage() {
  const [selectedProducts, setSelectedProducts] = useState<string[]>(["core", "sales-acceleration"]);

  const toggleProduct = (productId: string) => {
    if (selectedProducts.includes(productId)) {
      if (selectedProducts.length > 1) {
        setSelectedProducts(selectedProducts.filter(id => id !== productId));
      }
    } else {
      if (selectedProducts.length < 4) {
        setSelectedProducts([...selectedProducts, productId]);
      }
    }
  };

  const selectedProductsData = products.filter(p => selectedProducts.includes(p.id));

  const renderFeatureValue = (value: boolean | string) => {
    if (value === true) {
      return <CheckCircle className="h-5 w-5 text-accent mx-auto" />;
    }
    if (value === false) {
      return <XCircle className="h-5 w-5 text-muted-foreground/30 mx-auto" />;
    }
    return <span className="text-sm font-medium text-foreground">{value}</span>;
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-hero">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <h1 className="heading-display text-primary-foreground mb-6">
              Compare os Produtos
            </h1>
            <p className="text-xl text-primary-foreground/80 mb-8">
              Selecione até 4 produtos para comparar lado a lado e encontrar 
              o melhor fit para o momento da sua empresa.
            </p>
          </div>
        </div>
      </section>

      {/* Product Selector */}
      <section className="py-8 bg-secondary sticky top-16 z-40 border-b border-border">
        <div className="container-premium">
          <div className="flex flex-wrap justify-center gap-3">
            {products.map((product) => {
              const isSelected = selectedProducts.includes(product.id);
              const Icon = product.icon;
              return (
                <button
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all",
                    isSelected
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-accent/50"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isSelected && "text-accent")} />
                  <span className="font-medium text-sm">{product.name}</span>
                  {isSelected && (
                    <CheckCircle className="h-4 w-4 text-accent" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-center text-small text-muted-foreground mt-3">
            {selectedProducts.length}/4 produtos selecionados
          </p>
        </div>
      </section>

      {/* Comparison Header */}
      <section className="py-8 bg-background border-b border-border">
        <div className="container-premium">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4" />
                {selectedProductsData.map((product) => {
                  const Icon = product.icon;
                  return (
                    <div key={product.id} className="p-4 text-center">
                      <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3", product.color)}>
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <h3 className="font-semibold text-foreground text-lg">{product.name}</h3>
                      <p className="text-small text-muted-foreground mb-3">{product.tagline}</p>
                      <div className="space-y-1 text-sm">
                        <p className="text-accent font-bold">{product.price}</p>
                        <p className="text-muted-foreground">{product.priceType}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ICP Comparison */}
      <section className="py-6 bg-secondary">
        <div className="container-premium">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4">
                  <h4 className="font-semibold text-foreground">Perfil Ideal</h4>
                </div>
                {selectedProductsData.map((product) => (
                  <div key={product.id} className="p-4 text-center">
                    <p className="text-sm text-foreground">{product.icp}</p>
                  </div>
                ))}
              </div>
              <div className="grid" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-accent" />
                    Faturamento
                  </h4>
                </div>
                {selectedProductsData.map((product) => (
                  <div key={product.id} className="p-4 text-center">
                    <p className="text-sm font-medium text-foreground">{product.revenue}</p>
                  </div>
                ))}
              </div>
              <div className="grid" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Users2 className="h-4 w-4 text-accent" />
                    Time
                  </h4>
                </div>
                {selectedProductsData.map((product) => (
                  <div key={product.id} className="p-4 text-center">
                    <p className="text-sm font-medium text-foreground">{product.team}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {categories.map((category) => (
                <div key={category} className="mb-8">
                  <div className="grid mb-2" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                    <div className="p-4 bg-secondary rounded-l-lg">
                      <h3 className="font-bold text-foreground text-lg">{category}</h3>
                    </div>
                    {selectedProductsData.map((_, i) => (
                      <div key={i} className={cn("p-4 bg-secondary", i === selectedProductsData.length - 1 && "rounded-r-lg")} />
                    ))}
                  </div>
                  {features
                    .filter(f => f.category === category)
                    .map((feature, featureIndex) => (
                      <div 
                        key={feature.name} 
                        className="grid border-b border-border last:border-0"
                        style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}
                      >
                        <div className="p-4">
                          <h4 className="font-medium text-foreground text-sm">{feature.name}</h4>
                          <p className="text-xs text-muted-foreground">{feature.description}</p>
                        </div>
                        {selectedProductsData.map((product) => (
                          <div key={product.id} className="p-4 flex items-center justify-center">
                            {renderFeatureValue(feature.products[product.id])}
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Product Links */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-12">
            Saiba Mais Sobre Cada Produto
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {selectedProductsData.map((product) => {
              const Icon = product.icon;
              return (
                <Link 
                  key={product.id} 
                  to={product.link}
                  className="card-premium p-6 group hover:border-accent/50 transition-all"
                >
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", product.color)}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground text-lg mb-1">{product.name}</h3>
                  <p className="text-small text-muted-foreground mb-4">{product.tagline}</p>
                  <div className="flex items-center text-accent text-sm font-medium group-hover:gap-2 transition-all">
                    Ver detalhes
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-premium text-center">
          <h2 className="heading-section mb-4">
            Ainda em Dúvida?
          </h2>
          <p className="text-primary-foreground/70 text-lg mb-8 max-w-xl mx-auto">
            Use nossa ferramenta de diagnóstico para receber uma recomendação 
            personalizada baseada no momento da sua empresa.
          </p>
          <Link to="/for-closers">
            <Button variant="hero" size="xl">
              Fazer Diagnóstico
              <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
