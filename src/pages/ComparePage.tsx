import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  Target,
  Megaphone,
  Star,
  Brain,
  X,
  Heart,
  Users,
  DollarSign,
  Scale,
  Bot,
  Handshake,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientDiagnosticForm } from "@/components/ClientDiagnosticForm";
import { supabase } from "@/integrations/supabase/client";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Product {
  id: string;
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  category: string;
  icp: string;
  revenue: string;
  team: string;
  price: string;
  priceType: string;
  link: string;
  keyDiff: string;
  bestFor: string;
  notFor: string;
  highlights: string[];
}

const products: Product[] = [
  {
    id: "core",
    name: "UNV Core",
    tagline: "Fundação Comercial Inicial",
    icon: Layers,
    color: "bg-blue-500",
    category: "Trilha Principal",
    icp: "Empresas organizando a base comercial",
    revenue: "R$ 50k–150k/mês",
    team: "1–5 vendedores",
    price: "R$ 1.997",
    priceType: "único",
    link: "/core",
    keyDiff: "Produto de entrada — estrutura básica de vendas para quem está começando",
    bestFor: "Donos que vendem sozinhos ou com time pequeno e precisam de processo inicial",
    notFor: "Quem já tem processo estruturado ou busca aceleração",
    highlights: ["Diagnóstico comercial", "Funil estruturado", "Scripts essenciais", "Metas básicas"]
  },
  {
    id: "control",
    name: "UNV Control",
    tagline: "Direção Comercial Recorrente",
    icon: RefreshCw,
    color: "bg-emerald-500",
    category: "Trilha Principal",
    icp: "Empresas que precisam de constância e disciplina",
    revenue: "R$ 100k–400k/mês",
    team: "Qualquer tamanho",
    price: "R$ 5.997",
    priceType: "/ano",
    link: "/control",
    keyDiff: "Acompanhamento mensal recorrente — mantém a disciplina comercial ativa",
    bestFor: "Empresas que já vendem mas perdem ritmo sem cobrança externa",
    notFor: "Quem precisa de estruturação completa ou treinamento de time",
    highlights: ["Direção mensal", "Cobrança de execução", "Templates prontos", "AI Coach"]
  },
  {
    id: "sales-acceleration",
    name: "UNV Sales Acceleration",
    tagline: "Aceleração Comercial Completa",
    icon: TrendingUp,
    color: "bg-accent",
    category: "Trilha Principal",
    icp: "Empresas prontas para acelerar vendas",
    revenue: "R$ 150k–1M/mês",
    team: "3–20 vendedores",
    price: "R$ 24.000",
    priceType: "/ano",
    link: "/sales-acceleration",
    keyDiff: "Produto principal — direção + treinamento + cobrança integrados por 12 meses",
    bestFor: "Empresas com time comercial que querem acelerar resultados com método",
    notFor: "Quem não tem time ou busca apenas padronização",
    highlights: ["Direção semanal", "Treinamento do time", "Cobrança ativa", "Diagnóstico completo"]
  },
  {
    id: "sales-ops",
    name: "UNV Sales Ops",
    tagline: "Padronização & Treinamento de Times",
    icon: Users2,
    color: "bg-violet-500",
    category: "Operação",
    icp: "Empresas padronizando operação comercial",
    revenue: "R$ 200k+/mês",
    team: "5+ vendedores",
    price: "R$ 12.000",
    priceType: "/ano",
    link: "/sales-ops",
    keyDiff: "Operação comercial — trilhas por cargo, onboarding, treinamentos mensais em grupo",
    bestFor: "Empresas com time comercial que perdem padrão quando alguém sai",
    notFor: "Quem não tem time ou busca aceleração estratégica",
    highlights: ["Trilhas por cargo", "Onboarding estruturado", "Treinamentos mensais", "Certificações"]
  },
  {
    id: "ads",
    name: "UNV Ads",
    tagline: "Tráfego & Geração de Demanda",
    icon: Megaphone,
    color: "bg-green-500",
    category: "Operação",
    icp: "Empresas gerando demanda qualificada",
    revenue: "R$ 100k–1M+/mês",
    team: "Time comercial ativo",
    price: "R$ 1.800–4.000",
    priceType: "/mês + mídia",
    link: "/ads",
    keyDiff: "Geração de demanda — campanhas de tráfego pago integradas com vendas",
    bestFor: "Empresas que precisam de mais leads qualificados para o time comercial",
    notFor: "Quem não tem time comercial para atender os leads",
    highlights: ["Campanhas otimizadas", "Métricas CPL/CAC", "Integração vendas", "Relatórios"]
  },
  {
    id: "social",
    name: "UNV Social",
    tagline: "Social Media como Canal de Vendas",
    icon: MessageSquare,
    color: "bg-pink-500",
    category: "Operação",
    icp: "Empresas construindo autoridade",
    revenue: "R$ 80k–1M+/mês",
    team: "Negócios de confiança",
    price: "R$ 1.500–3.500",
    priceType: "/mês",
    link: "/social",
    keyDiff: "Autoridade digital — conteúdo estratégico para pré-venda e aquecimento",
    bestFor: "Empresas onde a venda depende de confiança e autoridade do dono",
    notFor: "Quem busca leads imediatos ou não quer aparecer",
    highlights: ["Conteúdo estratégico", "Posicionamento", "Autoridade digital", "Aquecimento"]
  },
  {
    id: "sales-force",
    name: "UNV Sales Force",
    tagline: "Outsourced SDR & Closing",
    icon: Users2,
    color: "bg-red-500",
    category: "Operação",
    icp: "Empresas com demanda que precisam de conversão",
    revenue: "R$ 100k–1M+/mês",
    team: "200+ leads/mês",
    price: "R$ 6.000",
    priceType: "/mês + comissão",
    link: "/sales-force",
    keyDiff: "Operação de vendas terceirizada — SDR e Closer executando para você",
    bestFor: "Empresas com demanda qualificada que não conseguem converter internamente",
    notFor: "Quem não gera leads ou quer testar",
    highlights: ["SDR terceirizado", "Closer dedicado", "Pipeline gerenciado", "Comissão por resultado"]
  },
  {
    id: "fractional-cro",
    name: "UNV Fractional CRO",
    tagline: "Diretor Comercial Terceirizado",
    icon: Target,
    color: "bg-amber-500",
    category: "Operação",
    icp: "Empresas com vendedores sem direção",
    revenue: "R$ 50k–500k/mês",
    team: "2–8 vendedores",
    price: "R$ 4.000 + comissão",
    priceType: "/mês",
    link: "/fractional-cro",
    keyDiff: "Direção comercial diária — reunião diária com time + cobrança + CRM",
    bestFor: "Donos cansados de cobrar vendas que precisam de direção diária",
    notFor: "Empresa sem vendedores ou dono que não aceita cobrança",
    highlights: ["Daily com time", "Gestão pipeline", "Cobrança diária", "CRM incluso"]
  },
  {
    id: "ai-sales-system",
    name: "UNV Sales System",
    tagline: "Inteligência Comercial Autônoma",
    icon: Bot,
    color: "bg-cyan-500",
    category: "Tecnologia",
    icp: "Empresas escalando vendas com IA",
    revenue: "R$ 100k–2M+/mês",
    team: "B2B e B2C",
    price: "R$ 297–9.997",
    priceType: "/mês + setup",
    link: "/ai-sales-system",
    keyDiff: "IA comercial — CRM inteligente + agentes autônomos + WhatsApp/Instagram",
    bestFor: "Empresas que querem escalar vendas com IA, reduzindo custo",
    notFor: "Quem não tem volume de leads ou busca só CRM tradicional",
    highlights: ["CRM inteligente", "Agentes autônomos", "WhatsApp Bot", "Instagram automation"]
  },
  {
    id: "partners",
    name: "UNV Partners",
    tagline: "Direção Estratégica & Board Externo",
    icon: Crown,
    color: "bg-amber-500",
    category: "Estratégico",
    icp: "Empresas buscando parceria estratégica",
    revenue: "R$ 300k–2M/mês",
    team: "CEO/fundador decisor",
    price: "R$ 30.000",
    priceType: "/ano",
    link: "/partners",
    keyDiff: "Board externo — Fabrício como diretor comercial de fato",
    bestFor: "Empresários que querem um parceiro de decisão, não apenas orientação",
    notFor: "Quem quer apenas treinamento ou precisa de execução",
    highlights: ["Board semanal", "Decisão conjunta", "Diagnóstico completo+", "Acesso direto"]
  },
  {
    id: "leadership",
    name: "UNV Leadership",
    tagline: "Formação de Liderança",
    icon: Brain,
    color: "bg-cyan-500",
    category: "Estratégico",
    icp: "Empresas formando líderes intermediários",
    revenue: "R$ 100k–2M+/mês",
    team: "Gestores, coordenadores",
    price: "R$ 15.000",
    priceType: "/ano",
    link: "/leadership",
    keyDiff: "Formação de líderes — liderança que sustenta pessoas e performance",
    bestFor: "Empresas onde fundador centraliza e líderes não cobram",
    notFor: "Quem busca motivação, coaching vazio ou RH terceirizado",
    highlights: ["Formação contínua", "Feedback estruturado", "Cobrança de líderes", "Certificação"]
  },
  {
    id: "people",
    name: "UNV People",
    tagline: "Gestão Estratégica de Pessoas",
    icon: Users,
    color: "bg-indigo-500",
    category: "Estratégico",
    icp: "Empresas escalando time comercial",
    revenue: "R$ 100k–2M+/mês",
    team: "5+ colaboradores",
    price: "R$ 2.500–8.000",
    priceType: "/mês ou por vaga",
    link: "/people",
    keyDiff: "Gestão de pessoas — contratação, onboarding e desenvolvimento",
    bestFor: "Empresas com turnover alto ou contratações erradas",
    notFor: "Quem busca RH operacional ou recrutamento pontual",
    highlights: ["Recrutamento", "Onboarding", "Desenvolvimento", "Retenção"]
  },
  {
    id: "finance",
    name: "UNV Finance",
    tagline: "Controle Financeiro Estratégico",
    icon: DollarSign,
    color: "bg-emerald-600",
    category: "Suporte",
    icp: "Empresas sem clareza financeira",
    revenue: "R$ 100k–2M+/mês",
    team: "Decisores",
    price: "R$ 3.000",
    priceType: "/mês",
    link: "/finance",
    keyDiff: "Clareza financeira — DRE, fluxo de caixa e margem sem burocracia",
    bestFor: "Empresários que faturam alto mas não sabem onde ganham ou perdem",
    notFor: "Quem busca contabilidade ou assessoria de investimentos",
    highlights: ["DRE mensal", "Fluxo de caixa", "Margem por produto", "Dashboards"]
  },
  {
    id: "safe",
    name: "UNV Safe",
    tagline: "Legal, Risk & Compliance",
    icon: Scale,
    color: "bg-blue-600",
    category: "Suporte",
    icp: "Empresas B2B em crescimento",
    revenue: "R$ 50k–2M/mês",
    team: "Operações com contratos",
    price: "R$ 3.000",
    priceType: "/mês",
    link: "/safe",
    keyDiff: "Jurídico preventivo — contratos, compliance e LGPD",
    bestFor: "Empresas que crescem rápido sem suporte jurídico estruturado",
    notFor: "Pessoa física ou advogado para causa pontual",
    highlights: ["Contratos", "Compliance", "LGPD", "Risk assessment"]
  },
  {
    id: "growth-room",
    name: "UNV Growth Room",
    tagline: "Imersão Presencial Estratégica",
    icon: MapPin,
    color: "bg-orange-500",
    category: "Eventos",
    icp: "Empresas que precisam de clareza estratégica",
    revenue: "R$ 150k–600k/mês",
    team: "Decisores apenas",
    price: "R$ 3.997",
    priceType: "por pessoa (3 dias)",
    link: "/growth-room",
    keyDiff: "Imersão presencial de 3 dias — clareza estratégica e plano de 90 dias",
    bestFor: "CEOs/donos que precisam parar e repensar a direção comercial",
    notFor: "Quem busca acompanhamento recorrente ou treinamento de time",
    highlights: ["3 dias presenciais", "Plano 90 dias", "Networking", "Clareza estratégica"]
  },
  {
    id: "mastermind",
    name: "UNV Mastermind",
    tagline: "Inner Circle de Líderes",
    icon: Star,
    color: "bg-amber-500",
    category: "Eventos",
    icp: "Empresários em estágio avançado",
    revenue: "R$ 1M–10M/mês",
    team: "Donos reais",
    price: "R$ 50.000",
    priceType: "/ano",
    link: "/mastermind",
    keyDiff: "Conselho de decisão — grupo ultra seletivo com hot seats e mansão",
    bestFor: "Empresários que já cresceram e querem decidir melhor com pares",
    notFor: "Quem busca execução, networking frouxo ou palco para ego",
    highlights: ["Hot seats", "Mansão empresarial", "Board coletivo", "Networking premium"]
  },
  {
    id: "le-desir",
    name: "Le Désir",
    tagline: "Análise Estratégica para Líderes",
    icon: Heart,
    color: "bg-rose-500",
    category: "Eventos",
    icp: "Líderes com peso psicológico",
    revenue: "R$ 200k–3M+/mês",
    team: "CEO/Fundador",
    price: "R$ 2.000",
    priceType: "/mês",
    link: "/le-desir",
    keyDiff: "Análise estratégica — suporte emocional para decisores sob pressão",
    bestFor: "Líderes exaustos ou com padrões que afetam decisões",
    notFor: "Quem busca terapia clínica ou mentoria de negócios",
    highlights: ["Análise individual", "Suporte emocional", "Padrões decisórios", "Confidencial"]
  },
  {
    id: "execution-partnership",
    name: "UNV Execution Partnership",
    tagline: "Parceria de Execução Intensiva",
    icon: Handshake,
    color: "bg-purple-600",
    category: "Estratégico",
    icp: "Empresas que precisam de execução imediata",
    revenue: "R$ 500k+/mês",
    team: "CEO + time comercial",
    price: "R$ 40.000",
    priceType: "(3 meses)",
    link: "/execution-partnership",
    keyDiff: "Imersão de 3 meses — direção comercial intensiva com execução",
    bestFor: "Empresas que precisam resolver gargalos rapidamente",
    notFor: "Quem busca consultoria pontual ou não tem urgência",
    highlights: ["3 meses intensivos", "Execução direta", "Acompanhamento semanal", "Resultados rápidos"]
  }
];

const categories = ["Trilha Principal", "Operação", "Tecnologia", "Estratégico", "Suporte", "Eventos"];

const categoryColors: Record<string, string> = {
  "Trilha Principal": "bg-accent text-white",
  "Operação": "bg-violet-500 text-white",
  "Tecnologia": "bg-cyan-500 text-white",
  "Estratégico": "bg-amber-500 text-white",
  "Suporte": "bg-emerald-600 text-white",
  "Eventos": "bg-orange-500 text-white"
};

export default function ComparePage() {
  const [selectedProducts, setSelectedProducts] = useState<string[]>(["core", "sales-acceleration"]);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<string[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const toggleCardExpansion = (productId: string) => {
    if (expandedCards.includes(productId)) {
      setExpandedCards(expandedCards.filter(id => id !== productId));
    } else {
      setExpandedCards([...expandedCards, productId]);
    }
  };

  const filteredProducts = activeCategory 
    ? products.filter(p => p.category === activeCategory)
    : products;

  const selectedProductsData = products.filter(p => selectedProducts.includes(p.id));

  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-to-br from-background via-background to-primary/5 border-b border-border/30">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <h1 className="heading-display text-foreground mb-4">
              Compare os Serviços
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Selecione até 4 serviços para comparar lado a lado e encontrar o melhor fit para sua empresa.
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-sm">
              <span className="text-muted-foreground">Filtrar por:</span>
              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "px-3 py-1 rounded-full transition-all",
                  !activeCategory 
                    ? "bg-accent text-white" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                Todos ({products.length})
              </button>
              {categories.map(cat => {
                const count = products.filter(p => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                    className={cn(
                      "px-3 py-1 rounded-full transition-all",
                      activeCategory === cat 
                        ? categoryColors[cat]
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Product Selector - Grid de cards */}
      <section className="py-8 bg-secondary/50 border-b border-border">
        <div className="container-premium">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredProducts.map((product) => {
              const isSelected = selectedProducts.includes(product.id);
              const Icon = product.icon;
              return (
                <button
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                    isSelected
                      ? "border-accent bg-accent/10 shadow-md"
                      : "border-border bg-background hover:border-accent/50 hover:shadow-sm"
                  )}
                >
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", product.color)}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-medium text-xs text-foreground leading-tight">{product.name.replace('UNV ', '')}</span>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full", categoryColors[product.category])}>
                    {product.category}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-4 mt-6">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{selectedProducts.length}/4</span> selecionados
            </p>
            {selectedProducts.length < 4 && (
              <p className="text-xs text-muted-foreground">
                Selecione mais {4 - selectedProducts.length} para comparar
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Comparison Cards - Desktop: grid, Mobile: stacked */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-8">
            Comparação Detalhada
          </h2>
          
          {/* Desktop Grid View */}
          <div className="hidden md:grid gap-6" style={{ gridTemplateColumns: `repeat(${selectedProductsData.length}, 1fr)` }}>
            {selectedProductsData.map((product, index) => {
              const Icon = product.icon;
              return (
                <Card key={product.id} className="relative overflow-hidden border-2 border-border hover:border-accent/50 transition-all">
                  {/* Color bar */}
                  <div className={cn("absolute top-0 left-0 right-0 h-1", product.color)} />
                  
                  {/* Index badge */}
                  <div className={cn(
                    "absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white",
                    product.color
                  )}>
                    {index + 1}
                  </div>
                  
                  <CardHeader className="pt-6 pb-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", product.color)}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">{product.tagline}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Price */}
                    <div className="bg-accent/10 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-accent">{product.price}</p>
                      <p className="text-sm text-muted-foreground">{product.priceType}</p>
                    </div>
                    
                    {/* ICP Info */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Perfil Ideal</p>
                        <p className="text-sm text-foreground">{product.icp}</p>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Faturamento</p>
                          <p className="text-sm font-medium text-foreground">{product.revenue}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Time</p>
                          <p className="text-sm font-medium text-foreground">{product.team}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Key Diff */}
                    <div className="bg-primary/5 rounded-lg p-3 border-l-4 border-primary">
                      <p className="text-xs font-semibold text-primary mb-1">🎯 Diferencial</p>
                      <p className="text-sm text-foreground">{product.keyDiff}</p>
                    </div>
                    
                    {/* Highlights */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Inclui</p>
                      <div className="flex flex-wrap gap-1.5">
                        {product.highlights.map((h, i) => (
                          <span key={i} className="text-xs bg-muted px-2 py-1 rounded-full text-foreground">
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Best For / Not For */}
                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-foreground">{product.bestFor}</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">{product.notFor}</p>
                      </div>
                    </div>
                    
                    {/* CTA */}
                    <Link to={product.link} className="block">
                      <Button variant="outline" className="w-full group">
                        Ver detalhes
                        <ExternalLink className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {/* Mobile Stacked View */}
          <div className="md:hidden space-y-4">
            {selectedProductsData.map((product, index) => {
              const Icon = product.icon;
              const isExpanded = expandedCards.includes(product.id);
              
              return (
                <Collapsible key={product.id} open={isExpanded} onOpenChange={() => toggleCardExpansion(product.id)}>
                  <Card className="relative overflow-hidden border-2 border-border">
                    {/* Color bar */}
                    <div className={cn("absolute top-0 left-0 right-0 h-1", product.color)} />
                    
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="pt-5 pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white",
                              product.color
                            )}>
                              {index + 1}
                            </div>
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", product.color)}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="text-left">
                              <h3 className="font-bold text-foreground">{product.name}</h3>
                              <p className="text-accent font-semibold text-sm">{product.price} <span className="text-muted-foreground font-normal">{product.priceType}</span></p>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-4">
                        {/* ICP Info */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Faturamento</p>
                            <p className="font-medium text-foreground">{product.revenue}</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">Time</p>
                            <p className="font-medium text-foreground">{product.team}</p>
                          </div>
                        </div>
                        
                        {/* Key Diff */}
                        <div className="bg-primary/5 rounded-lg p-3 border-l-4 border-primary">
                          <p className="text-xs font-semibold text-primary mb-1">🎯 Diferencial</p>
                          <p className="text-sm text-foreground">{product.keyDiff}</p>
                        </div>
                        
                        {/* Highlights */}
                        <div className="flex flex-wrap gap-1.5">
                          {product.highlights.map((h, i) => (
                            <span key={i} className="text-xs bg-muted px-2 py-1 rounded-full text-foreground">
                              {h}
                            </span>
                          ))}
                        </div>
                        
                        {/* Best For / Not For */}
                        <div className="space-y-2 pt-2 border-t border-border">
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-foreground">{product.bestFor}</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">{product.notFor}</p>
                          </div>
                        </div>
                        
                        {/* CTA */}
                        <Link to={product.link}>
                          <Button variant="outline" className="w-full">
                            Ver detalhes
                            <ExternalLink className="h-4 w-4 ml-2" />
                          </Button>
                        </Link>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quick Comparison Table - Desktop only */}
      <section className="hidden lg:block py-12 bg-secondary/30">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-8">
            Resumo Comparativo
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left p-4 font-semibold text-foreground">Característica</th>
                  {selectedProductsData.map((product) => {
                    const Icon = product.icon;
                    return (
                      <th key={product.id} className="p-4 text-center min-w-[180px]">
                        <div className="flex flex-col items-center gap-2">
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", product.color)}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <span className="font-semibold text-foreground text-sm">{product.name.replace('UNV ', '')}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-4 font-medium text-foreground">Preço</td>
                  {selectedProductsData.map((product) => (
                    <td key={product.id} className="p-4 text-center">
                      <span className="font-bold text-accent">{product.price}</span>
                      <span className="text-xs text-muted-foreground block">{product.priceType}</span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-4 font-medium text-foreground">Faturamento ideal</td>
                  {selectedProductsData.map((product) => (
                    <td key={product.id} className="p-4 text-center text-sm text-foreground">{product.revenue}</td>
                  ))}
                </tr>
                <tr className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-4 font-medium text-foreground">Tamanho do time</td>
                  {selectedProductsData.map((product) => (
                    <td key={product.id} className="p-4 text-center text-sm text-foreground">{product.team}</td>
                  ))}
                </tr>
                <tr className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-4 font-medium text-foreground">Categoria</td>
                  {selectedProductsData.map((product) => (
                    <td key={product.id} className="p-4 text-center">
                      <span className={cn("text-xs px-2 py-1 rounded-full", categoryColors[product.category])}>
                        {product.category}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-muted/30">
                  <td className="p-4 font-medium text-foreground">Ação</td>
                  {selectedProductsData.map((product) => (
                    <td key={product.id} className="p-4 text-center">
                      <Link to={product.link}>
                        <Button size="sm" variant="outline" className="text-xs">
                          Ver mais <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section mb-4">
              Ainda não sabe qual escolher?
            </h2>
            <p className="text-lg opacity-90 mb-8">
              Faça nosso diagnóstico gratuito e receba uma recomendação personalizada baseada no momento da sua empresa.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary"
                onClick={() => setShowDiagnostic(true)}
              >
                Fazer Diagnóstico Gratuito
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Link to="/pricing">
                <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                  Ver Trilha Completa
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Diagnostic Modal */}
      {showDiagnostic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background rounded-2xl border shadow-xl">
            <button
              onClick={() => setShowDiagnostic(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-6">
              <ClientDiagnosticForm />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
