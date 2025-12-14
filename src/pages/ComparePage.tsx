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
  Target,
  Megaphone,
  Star,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientDiagnosticForm } from "@/components/ClientDiagnosticForm";

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
  keyDiff: string;
  bestFor: string;
  notFor: string;
}

const products: Product[] = [
  {
    id: "core",
    name: "UNV Core",
    tagline: "Fundação Comercial Inicial",
    icon: Layers,
    color: "bg-blue-500",
    icp: "Empresas organizando a base comercial",
    revenue: "R$ 50k–150k/mês",
    team: "1–5 vendedores",
    price: "R$ 997 a R$ 1.997",
    priceType: "único",
    link: "/core",
    keyDiff: "Produto de entrada — estrutura básica de vendas para quem está começando",
    bestFor: "Donos que vendem sozinhos ou com time pequeno e precisam de processo inicial",
    notFor: "Quem já tem processo estruturado ou busca aceleração"
  },
  {
    id: "control",
    name: "UNV Control",
    tagline: "Direção Comercial Recorrente",
    icon: RefreshCw,
    color: "bg-emerald-500",
    icp: "Empresas que precisam de constância e disciplina",
    revenue: "R$ 100k–400k/mês",
    team: "Qualquer tamanho",
    price: "R$ 597",
    priceType: "/mês ou R$ 5.997/ano",
    link: "/control",
    keyDiff: "Acompanhamento mensal recorrente — mantém a disciplina comercial ativa",
    bestFor: "Empresas que já vendem mas perdem ritmo sem cobrança externa",
    notFor: "Quem precisa de estruturação completa ou treinamento de time"
  },
  {
    id: "sales-acceleration",
    name: "UNV Sales Acceleration",
    tagline: "Aceleração Comercial Completa",
    icon: TrendingUp,
    color: "bg-accent",
    icp: "Empresas prontas para acelerar vendas",
    revenue: "R$ 150k–1M/mês",
    team: "3–20 vendedores",
    price: "R$ 24.000",
    priceType: "/ano",
    link: "/sales-acceleration",
    keyDiff: "Produto principal — direção + treinamento + cobrança integrados por 12 meses",
    bestFor: "Empresas com time comercial que querem acelerar resultados com método",
    notFor: "Quem não tem time ou busca apenas padronização"
  },
  {
    id: "growth-room",
    name: "UNV Growth Room",
    tagline: "Imersão Presencial Estratégica",
    icon: MapPin,
    color: "bg-orange-500",
    icp: "Empresas que precisam de clareza estratégica",
    revenue: "R$ 150k–600k/mês",
    team: "Decisores apenas",
    price: "R$ 12.000",
    priceType: "por empresa",
    link: "/growth-room",
    keyDiff: "Imersão presencial de 3 dias — clareza estratégica e plano de 90 dias",
    bestFor: "CEOs/donos que precisam parar e repensar a direção comercial",
    notFor: "Quem busca acompanhamento recorrente ou treinamento de time"
  },
  {
    id: "partners",
    name: "UNV Partners",
    tagline: "Direção Estratégica & Board Externo",
    icon: Crown,
    color: "bg-amber-500",
    icp: "Empresas buscando parceria estratégica de decisão",
    revenue: "R$ 300k–2M/mês",
    team: "CEO/fundador decisor",
    price: "R$ 4.000",
    priceType: "/mês (12 meses)",
    link: "/partners",
    keyDiff: "Board externo — Fabrício como diretor comercial de fato, não consultor",
    bestFor: "Empresários que querem um parceiro de decisão, não apenas orientação",
    notFor: "Quem quer apenas treinamento ou precisa de execução"
  },
  {
    id: "sales-ops",
    name: "UNV Sales Ops",
    tagline: "Padronização & Treinamento de Times",
    icon: Users2,
    color: "bg-violet-500",
    icp: "Empresas padronizando operação comercial",
    revenue: "R$ 200k+/mês",
    team: "5+ vendedores",
    price: "R$ 197",
    priceType: "/usuário/mês",
    link: "/sales-ops",
    keyDiff: "Operação comercial — trilhas por cargo, onboarding, padronização de discurso",
    bestFor: "Empresas com time comercial que perdem padrão quando alguém sai",
    notFor: "Quem não tem time ou busca aceleração estratégica"
  },
  {
    id: "ads",
    name: "UNV Ads",
    tagline: "Tráfego & Geração de Demanda",
    icon: Megaphone,
    color: "bg-green-500",
    icp: "Empresas gerando demanda qualificada",
    revenue: "R$ 100k–1M+/mês",
    team: "Time comercial ativo",
    price: "R$ 1.500 a R$ 4.000",
    priceType: "/mês + mídia",
    link: "/ads",
    keyDiff: "Geração de demanda — campanhas de tráfego pago integradas com vendas",
    bestFor: "Empresas que precisam de mais leads qualificados para o time comercial",
    notFor: "Quem não tem time comercial para atender os leads"
  },
  {
    id: "social",
    name: "UNV Social",
    tagline: "Social Media como Canal de Vendas",
    icon: MessageSquare,
    color: "bg-pink-500",
    icp: "Empresas construindo autoridade",
    revenue: "R$ 80k–1M+/mês",
    team: "Negócios de confiança",
    price: "R$ 1.500 a R$ 3.500",
    priceType: "/mês",
    link: "/social",
    keyDiff: "Autoridade digital — conteúdo estratégico para pré-venda e aquecimento",
    bestFor: "Empresas onde a venda depende de confiança e autoridade do dono",
    notFor: "Quem busca leads imediatos ou não quer aparecer"
  },
  {
    id: "mastermind",
    name: "UNV Mastermind",
    tagline: "Inner Circle de Líderes",
    icon: Star,
    color: "bg-amber-500",
    icp: "Empresários em estágio avançado",
    revenue: "R$ 300k–3M/mês",
    team: "Donos reais",
    price: "R$ 36.000",
    priceType: "/ano",
    link: "/mastermind",
    keyDiff: "Conselho de decisão — grupo ultra seletivo com hot seats e mansão empresarial",
    bestFor: "Empresários que já cresceram e querem decidir melhor com pares à altura",
    notFor: "Quem busca execução, networking frouxo ou palco para ego"
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
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Board coletivo"
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
      "sales-ops": false,
      ads: "Otimização",
      social: false,
      mastermind: false
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
      "sales-ops": "Via trilhas",
      ads: false,
      social: false,
      mastermind: false
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
      "sales-ops": false,
      ads: "De demanda",
      social: "Posicionamento",
      mastermind: false
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
      "sales-ops": false,
      ads: "Aquisição",
      social: false,
      mastermind: false
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
      "sales-ops": "Por cargo",
      ads: "Copies",
      social: "Conteúdo",
      mastermind: false
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
      "sales-ops": "Por cargo",
      ads: "CPL/CAC",
      social: false,
      mastermind: false
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
      "sales-ops": "Trilhas por cargo",
      ads: false,
      social: false,
      mastermind: false
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
      "sales-ops": true,
      ads: false,
      social: false,
      mastermind: false
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
      "sales-ops": true,
      ads: false,
      social: false,
      mastermind: false
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
      "sales-ops": "Por cargo",
      ads: "Ads",
      social: "Social",
      mastermind: "Mastermind"
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
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Ultra seletiva"
    }
  },
  // Aquisição
  {
    name: "Gestão de Tráfego",
    description: "Campanhas de mídia paga",
    category: "Aquisição",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: "Completa",
      social: false,
      mastermind: false
    }
  },
  {
    name: "Geração de Leads",
    description: "Captação de demanda qualificada",
    category: "Aquisição",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: true,
      social: "Indireta",
      mastermind: false
    }
  },
  {
    name: "Integração Marketing/Vendas",
    description: "Alinhamento de canais",
    category: "Aquisição",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: true,
      social: true,
      mastermind: false
    }
  },
  // Social
  {
    name: "Estratégia de Conteúdo",
    description: "Linhas editoriais comerciais",
    category: "Social",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: "Completa",
      mastermind: false
    }
  },
  {
    name: "Construção de Autoridade",
    description: "Posicionamento e credibilidade",
    category: "Social",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: true,
      mastermind: false
    }
  },
  {
    name: "Conteúdo de Pré-Venda",
    description: "Aquecimento de leads",
    category: "Social",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: true,
      mastermind: false
    }
  },
  // Mastermind
  {
    name: "Sessões de Hot Seat",
    description: "Decisões estratégicas em grupo",
    category: "Mastermind",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Mensal"
    }
  },
  {
    name: "Mansão Empresarial",
    description: "Encontros presenciais privados",
    category: "Mastermind",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Mensal"
    }
  },
  {
    name: "Direção Individual",
    description: "Sessões privadas com Fabrício",
    category: "Mastermind",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: "Recorrente",
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "2x/ano"
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
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Mensais"
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
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Recorrente"
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
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Real e profundo"
    }
  }
];

const categories = [...new Set(features.map(f => f.category))];

export default function ComparePage() {
  const [selectedProducts, setSelectedProducts] = useState<string[]>(["core", "sales-acceleration"]);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

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
      <section className="section-padding bg-card border-b border-border/30">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <h1 className="heading-display text-foreground mb-6">
              Compare os Produtos
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
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
                <div className="p-4 bg-secondary/50">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Users2 className="h-4 w-4 text-accent" />
                    Time
                  </h4>
                </div>
                {selectedProductsData.map((product) => (
                  <div key={product.id} className="p-4 text-center bg-secondary/50">
                    <p className="text-sm font-medium text-foreground">{product.team}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Differences Section - NEW */}
      <section className="py-8 bg-background border-b border-border">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-8">
            Diferenças-Chave
          </h2>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Principal diferença */}
              <div className="grid mb-4" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4 bg-accent/10 rounded-l-lg border-l-4 border-accent">
                  <h4 className="font-bold text-foreground">🎯 Principal Diferença</h4>
                  <p className="text-xs text-muted-foreground">O que torna cada produto único</p>
                </div>
                {selectedProductsData.map((product, i) => (
                  <div key={product.id} className={cn("p-4 bg-accent/5", i === selectedProductsData.length - 1 && "rounded-r-lg")}>
                    <p className="text-sm font-medium text-foreground">{product.keyDiff}</p>
                  </div>
                ))}
              </div>

              {/* Para quem é */}
              <div className="grid mb-4" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4 bg-emerald-500/10 rounded-l-lg border-l-4 border-emerald-500">
                  <h4 className="font-bold text-foreground">✅ Melhor Para</h4>
                  <p className="text-xs text-muted-foreground">Quem deve escolher este produto</p>
                </div>
                {selectedProductsData.map((product, i) => (
                  <div key={product.id} className={cn("p-4 bg-emerald-500/5", i === selectedProductsData.length - 1 && "rounded-r-lg")}>
                    <p className="text-sm text-foreground">{product.bestFor}</p>
                  </div>
                ))}
              </div>

              {/* Para quem NÃO é */}
              <div className="grid" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4 bg-destructive/10 rounded-l-lg border-l-4 border-destructive">
                  <h4 className="font-bold text-foreground">❌ Não É Para</h4>
                  <p className="text-xs text-muted-foreground">Quem não deve escolher este produto</p>
                </div>
                {selectedProductsData.map((product, i) => (
                  <div key={product.id} className={cn("p-4 bg-destructive/5", i === selectedProductsData.length - 1 && "rounded-r-lg")}>
                    <p className="text-sm text-muted-foreground">{product.notFor}</p>
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
          <h2 className="heading-section text-foreground text-center mb-8">
            Comparativo Detalhado de Features
          </h2>
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
      <section className="section-padding bg-card border-y border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        <div className="container-premium text-center relative">
          <h2 className="heading-section text-foreground mb-4">
            Ainda em Dúvida?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Responda algumas perguntas rápidas e receba uma recomendação 
            personalizada baseada no momento da sua empresa.
          </p>
          <Button variant="hero" size="xl" onClick={() => setShowDiagnostic(true)}>
            Qual Produto é Ideal Para Mim?
            <ArrowRight className="ml-2" />
          </Button>
        </div>
      </section>

      {/* Diagnostic Modal */}
      {showDiagnostic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">
                Descubra o Produto Ideal
              </h2>
              <button 
                onClick={() => setShowDiagnostic(false)}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6">
              <ClientDiagnosticForm onClose={() => setShowDiagnostic(false)} />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
