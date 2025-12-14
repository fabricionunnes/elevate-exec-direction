import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import heroBoardroom from "@/assets/hero-boardroom.jpg";
import salesTeam from "@/assets/sales-team.jpg";

const problems = [
  "Time comercial improvisando ao invés de seguir um processo comprovado",
  "Leads morrendo no pipeline sem follow-up adequado",
  "Taxa de conversão oscilando sem previsibilidade",
  "Dono se tornando gargalo em todos os negócios",
  "Sem métricas claras ou estrutura de cobrança",
];

const products = [
  {
    name: "UNV Core",
    description: "Estruture sua base comercial",
    icp: "R$ 50k–150k/mês",
    href: "/core",
  },
  {
    name: "UNV Control",
    description: "Mantenha a constância de execução",
    icp: "R$ 100k–400k/mês",
    href: "/control",
  },
  {
    name: "Sales Acceleration",
    description: "Programa completo de direção comercial",
    icp: "R$ 150k–1M/mês",
    href: "/sales-acceleration",
    highlight: true,
  },
  {
    name: "Growth Room",
    description: "Imersão estratégica presencial intensiva",
    icp: "R$ 150k–600k/mês",
    href: "/growth-room",
  },
  {
    name: "UNV Partners",
    description: "Mentoria estratégica elite + Experiência Mansão",
    icp: "R$ 300k–2M/mês",
    href: "/partners",
  },
  {
    name: "Sales Ops",
    description: "Padronização de times em escala",
    icp: "5+ vendedores",
    href: "/sales-ops",
  },
];

const processSteps = [
  {
    step: "01",
    title: "Aplicação",
    description: "Envie seu perfil empresarial para análise inicial",
  },
  {
    step: "02",
    title: "Diagnóstico",
    description: "Avaliação profunda da sua operação comercial",
  },
  {
    step: "03",
    title: "Proposta",
    description: "Plano de direção personalizado para seu contexto",
  },
  {
    step: "04",
    title: "Onboarding",
    description: "Início da execução estruturada com cobrança",
  },
];

export default function HomePage() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBoardroom})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>

        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl">
            <h1 className="heading-display text-primary-foreground mb-6 opacity-0 animate-fade-up">
              Atuamos como seu Diretor Comercial.
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-8 opacity-0 animate-fade-up delay-100">
              A UNV treina, acompanha e cobra seu time comercial para acelerar
              vendas com método e previsibilidade.
            </p>

            <ul className="space-y-3 mb-10 opacity-0 animate-fade-up delay-200">
              {[
                "Treinamento prático do time",
                "Acompanhamento e cobrança contínua",
                "Quick wins no 1º mês (meta operacional)",
                "Payback projetado até o 3º mês (projeção, sem garantia)",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 text-primary-foreground/90"
                >
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4 opacity-0 animate-fade-up delay-300">
              <Link to="/apply">
                <Button variant="hero" size="xl">
                  Aplicar para Diagnóstico
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a
                href="https://wa.me/5500000000000"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="hero-outline" size="xl">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="heading-section text-foreground mb-6">
              Seu problema de vendas não é esforço.
              <span className="block text-accent">É falta de direção.</span>
            </h2>
            <p className="text-body">
              Sem direção comercial adequada, até times talentosos performam
              abaixo do potencial. Esses sintomas podem parecer familiares:
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {problems.map((problem, i) => (
              <div
                key={i}
                className="card-premium p-6 hover:border-accent/30 transition-all"
              >
                <div className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                  <p className="text-foreground font-medium">{problem}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Product Highlight */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="card-highlight p-8 md:p-12 lg:p-16 flex flex-col lg:flex-row gap-8 lg:gap-16 items-center">
            <div className="flex-1">
              <div className="inline-block px-4 py-1.5 bg-accent/10 text-accent text-sm font-medium rounded-full mb-6">
                Programa Principal
              </div>
              <h2 className="heading-section text-foreground mb-4">
                UNV Sales Acceleration
              </h2>
              <p className="text-body mb-8">
                Programa anual de direção comercial para treinar, acompanhar e
                acelerar seu time de vendas. De quick wins a crescimento
                sustentável, com cobrança total de execução.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/sales-acceleration">
                  <Button variant="premium" size="lg">
                    Explorar Programa
                    <ArrowRight className="ml-2" />
                  </Button>
                </Link>
                <Link to="/apply">
                  <Button variant="premium-outline" size="lg">
                    Aplicar Agora
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex-1 w-full lg:w-auto">
              <img
                src={salesTeam}
                alt="Time de vendas profissional em escritório moderno"
                className="rounded-lg shadow-premium w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Product Ladder */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Encontre Seu Ponto de Entrada
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Cada empresa tem necessidades diferentes. Nossa escada de produtos
              te encontra onde você está e cresce com você.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Link
                key={product.href}
                to={product.href}
                className={`group ${
                  product.highlight ? "card-highlight" : "card-premium"
                } p-6 hover:border-accent/50 transition-all`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="heading-card text-foreground group-hover:text-accent transition-colors">
                    {product.name}
                  </h3>
                  {product.highlight && (
                    <span className="px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded">
                      Destaque
                    </span>
                  )}
                </div>
                <p className="text-body mb-4">{product.description}</p>
                <p className="text-small">ICP: {product.icp}</p>
                <div className="mt-4 flex items-center text-accent text-sm font-medium">
                  Saiba mais
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/products">
              <Button variant="premium-outline" size="lg">
                Ver Todos os Produtos
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section mb-4">Como Começamos</h2>
            <p className="text-primary-foreground/70 text-lg max-w-2xl mx-auto">
              Um processo de onboarding estruturado garante que entendamos seu
              contexto antes de propor soluções.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {processSteps.map((step, i) => (
              <div key={i} className="text-center lg:text-left">
                <div className="text-5xl font-display font-bold text-accent/30 mb-4">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-primary-foreground/70">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <Link to="/apply">
              <Button variant="hero" size="xl">
                Iniciar Sua Aplicação
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
