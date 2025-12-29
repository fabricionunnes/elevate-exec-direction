import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Target,
  Compass,
  TrendingUp,
  Users,
  Megaphone,
  Share2,
  Building2,
  Handshake,
  Crown,
  Sparkles,
  DollarSign,
  Shield,
  Bot,
  UserCheck,
  ExternalLink
} from "lucide-react";

interface ProductPrice {
  id: string;
  name: string;
  tagline: string;
  icon: React.ElementType;
  color: string;
  price: string;
  priceType: string;
  priceNote?: string;
  tiers?: { label: string; price: string }[];
  link: string;
  category: string;
}

const products: ProductPrice[] = [
  // Trilha Principal
  {
    id: "core",
    name: "UNV Core",
    tagline: "Estruturação Comercial Inicial",
    icon: Target,
    color: "text-red-500 bg-red-500/10",
    price: "R$ 1.997",
    priceType: "único",
    link: "/core",
    category: "Trilha Principal"
  },
  {
    id: "control",
    name: "UNV Control",
    tagline: "Direção Comercial Recorrente",
    icon: Compass,
    color: "text-blue-500 bg-blue-500/10",
    price: "R$ 2.500",
    priceType: "/mês",
    link: "/control",
    category: "Trilha Principal"
  },
  {
    id: "sales-acceleration",
    name: "UNV Sales Acceleration",
    tagline: "Aceleração com Acompanhamento Individual",
    icon: TrendingUp,
    color: "text-green-500 bg-green-500/10",
    price: "R$ 5.000",
    priceType: "/mês",
    link: "/sales-acceleration",
    category: "Trilha Principal"
  },
  // Operação Comercial
  {
    id: "sales-ops",
    name: "UNV Sales Ops",
    tagline: "Treinamento de Time Comercial",
    icon: Users,
    color: "text-orange-500 bg-orange-500/10",
    price: "R$ 12.000",
    priceType: "/ano",
    priceNote: "À vista ou parcelado",
    link: "/sales-ops",
    category: "Operação Comercial"
  },
  {
    id: "ads",
    name: "UNV Ads",
    tagline: "Gestão de Tráfego Pago",
    icon: Megaphone,
    color: "text-purple-500 bg-purple-500/10",
    price: "A partir de R$ 1.800",
    priceType: "/mês",
    tiers: [
      { label: "Até R$ 10k investidos", price: "R$ 1.800" },
      { label: "Até R$ 20k investidos", price: "R$ 2.500" },
      { label: "Até R$ 50k investidos", price: "R$ 4.000" },
      { label: "Acima de R$ 50k", price: "% sobre investido" }
    ],
    link: "/ads",
    category: "Operação Comercial"
  },
  {
    id: "social",
    name: "UNV Social",
    tagline: "Gestão de Redes Sociais",
    icon: Share2,
    color: "text-pink-500 bg-pink-500/10",
    price: "A partir de R$ 1.500",
    priceType: "/mês",
    link: "/social",
    category: "Operação Comercial"
  },
  {
    id: "ai-sales-system",
    name: "A.I. Sales System",
    tagline: "Automação com Inteligência Artificial",
    icon: Bot,
    color: "text-cyan-500 bg-cyan-500/10",
    price: "R$ 297 a R$ 9.997",
    priceType: "/mês",
    priceNote: "+ Implementação de R$ 2.500 a R$ 25.000",
    link: "/ai-sales-system",
    category: "Operação Comercial"
  },
  {
    id: "fractional-cro",
    name: "UNV Fractional CRO",
    tagline: "Diretor Comercial Terceirizado",
    icon: UserCheck,
    color: "text-indigo-500 bg-indigo-500/10",
    price: "R$ 4.000",
    priceType: "/mês",
    priceNote: "+ Comissão variável escalonável",
    link: "/fractional-cro",
    category: "Operação Comercial"
  },
  // Trilha Avançada
  {
    id: "growth-room",
    name: "UNV Growth Room",
    tagline: "Grupo Estratégico de Crescimento",
    icon: Building2,
    color: "text-amber-500 bg-amber-500/10",
    price: "R$ 36.000",
    priceType: "/ano",
    link: "/growth-room",
    category: "Trilha Avançada"
  },
  {
    id: "partners",
    name: "UNV Partners",
    tagline: "Programa de Parceiros Estratégicos",
    icon: Handshake,
    color: "text-emerald-500 bg-emerald-500/10",
    price: "R$ 30.000",
    priceType: "/ano",
    priceNote: "À vista ou parcelado",
    link: "/partners",
    category: "Trilha Avançada"
  },
  {
    id: "mastermind",
    name: "UNV Mastermind",
    tagline: "Grupo Exclusivo de Empresários",
    icon: Crown,
    color: "text-yellow-500 bg-yellow-500/10",
    price: "R$ 120.000",
    priceType: "/ano",
    priceNote: "Vagas limitadas",
    link: "/mastermind",
    category: "Trilha Avançada"
  },
  // Estratégia & Estrutura
  {
    id: "le-desir",
    name: "UNV Le Désir",
    tagline: "Posicionamento Premium",
    icon: Sparkles,
    color: "text-rose-500 bg-rose-500/10",
    price: "R$ 2.000",
    priceType: "/mês",
    link: "/le-desir",
    category: "Estratégia & Estrutura"
  },
  {
    id: "people",
    name: "UNV People",
    tagline: "Gestão de Pessoas",
    icon: Users,
    color: "text-blue-500 bg-blue-500/10",
    price: "R$ 2.500 a R$ 6.000",
    priceType: "/mês",
    tiers: [
      { label: "Até 20 colaboradores", price: "R$ 2.500" },
      { label: "Até 35 colaboradores", price: "R$ 5.000" },
      { label: "Até 100 colaboradores", price: "R$ 6.000" },
      { label: "Hiring operacional", price: "R$ 4.000 (avulso)" },
      { label: "Hiring liderança", price: "R$ 8.000 (avulso)" }
    ],
    link: "/people",
    category: "Estratégia & Estrutura"
  },
  {
    id: "finance",
    name: "UNV Finance",
    tagline: "Controle Financeiro Estratégico",
    icon: DollarSign,
    color: "text-green-500 bg-green-500/10",
    price: "R$ 3.000",
    priceType: "/mês",
    link: "/finance",
    category: "Estratégia & Estrutura"
  },
  {
    id: "safe",
    name: "UNV Safe",
    tagline: "Assessoria Jurídica Preventiva",
    icon: Shield,
    color: "text-slate-500 bg-slate-500/10",
    price: "R$ 3.000",
    priceType: "/mês",
    link: "/safe",
    category: "Estratégia & Estrutura"
  },
  // Outros
  {
    id: "leadership",
    name: "UNV Leadership",
    tagline: "Desenvolvimento de Líderes",
    icon: UserCheck,
    color: "text-violet-500 bg-violet-500/10",
    price: "R$ 10.000",
    priceType: "/ano",
    priceNote: "Por empresa",
    link: "/leadership",
    category: "Outros"
  }
];

const categories = [
  "Trilha Principal",
  "Operação Comercial",
  "Trilha Avançada",
  "Estratégia & Estrutura",
  "Outros"
];

export default function PricingPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="container-premium relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-up">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Tabela de Produtos e Preços
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Todos os produtos UNV com seus respectivos investimentos. Encontre a solução ideal para o momento da sua empresa.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
                <Link to="/diagnostic">
                  Fazer Diagnóstico Gratuito
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/compare">
                  Comparar Produtos
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Products by Category */}
      {categories.map((category) => {
        const categoryProducts = products.filter(p => p.category === category);
        if (categoryProducts.length === 0) return null;
        
        return (
          <section key={category} className="section-padding bg-background border-b border-border/50">
            <div className="container-premium">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
                {category}
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {categoryProducts.map((product) => (
                  <div 
                    key={product.id}
                    className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-lg transition-all duration-300"
                  >
                    {/* Header */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${product.color}`}>
                        <product.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-lg">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">{product.tagline}</p>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-4 p-4 bg-secondary/50 rounded-xl">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-foreground">{product.price}</span>
                        {product.priceType && (
                          <span className="text-muted-foreground">{product.priceType}</span>
                        )}
                      </div>
                      {product.priceNote && (
                        <p className="text-xs text-muted-foreground mt-1">{product.priceNote}</p>
                      )}
                    </div>

                    {/* Tiers */}
                    {product.tiers && (
                      <div className="mb-4 space-y-2">
                        {product.tiers.map((tier, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{tier.label}</span>
                            <span className="font-medium text-foreground">{tier.price}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CTA */}
                    <Button variant="outline" className="w-full" asChild>
                      <Link to={product.link}>
                        Ver Detalhes
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* Mansão */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
                <Crown className="h-8 w-8 text-yellow-500" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Mansão Empreendedora</h3>
              <p className="text-muted-foreground mb-4">Experiência presencial exclusiva para membros do Mastermind</p>
              <p className="text-lg font-semibold text-foreground mb-4">Apenas para convidados</p>
              <Button variant="outline" asChild>
                <a href="https://mansaoempreendedora.com.br" target="_blank" rel="noopener noreferrer">
                  Saiba Mais
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="section-padding bg-card border-t border-border">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Não sabe qual produto é ideal para você?
            </h2>
            <p className="text-muted-foreground mb-8">
              Faça nosso diagnóstico gratuito e receba uma recomendação personalizada.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
                <Link to="/diagnostic">
                  Fazer Diagnóstico Gratuito
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/apply">
                  Falar com Especialista
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}