import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, MessageCircle, Sparkles } from "lucide-react";
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
    price: "R$ 1.997",
    href: "/core",
  },
  {
    name: "UNV Control",
    description: "Mantenha a constância de execução",
    icp: "R$ 100k–400k/mês",
    price: "R$ 597/mês",
    href: "/control",
  },
  {
    name: "Sales Acceleration",
    description: "Programa completo de direção comercial",
    icp: "R$ 150k–1M/mês",
    price: "R$ 24.000/ano",
    href: "/sales-acceleration",
    highlight: true,
  },
  {
    name: "Growth Room",
    description: "Imersão estratégica presencial intensiva",
    icp: "R$ 150k–600k/mês",
    price: "R$ 12.000",
    href: "/growth-room",
  },
  {
    name: "UNV Partners",
    description: "Direção estratégica elite + Experiência Mansão",
    icp: "R$ 300k–2M/mês",
    price: "R$ 4.000/mês",
    href: "/partners",
  },
  {
    name: "Sales Ops",
    description: "Padronização de times em escala",
    icp: "5+ vendedores",
    price: "R$ 197/usuário/mês",
    href: "/sales-ops",
  },
  {
    name: "UNV Ads",
    description: "Tráfego e geração de demanda qualificada",
    icp: "R$ 100k–1M+/mês",
    price: "R$ 1.500–4.000/mês",
    href: "/ads",
  },
  {
    name: "UNV Social",
    description: "Social media como canal de vendas",
    icp: "R$ 80k–1M+/mês",
    price: "R$ 1.500–3.500/mês",
    href: "/social",
  },
  {
    name: "UNV Mastermind",
    description: "Inner Circle de líderes empresariais",
    icp: "R$ 300k–3M/mês",
    price: "R$ 36.000/ano",
    href: "/mastermind",
    highlight: true,
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
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBoardroom})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-glow opacity-50 pointer-events-none" />

        <div className="container-premium relative z-10 py-32">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full text-primary text-sm font-medium mb-8 opacity-0 animate-fade-up">
              <Sparkles className="h-4 w-4" />
              Direção Comercial como Serviço
            </div>
            
            <h1 className="heading-display text-foreground mb-8 opacity-0 animate-fade-up delay-100">
              Atuamos como seu{" "}
              <span className="text-gradient-gold">Diretor Comercial.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl opacity-0 animate-fade-up delay-200">
              A UNV treina, acompanha e cobra seu time comercial para acelerar
              vendas com método e previsibilidade.
            </p>

            <ul className="space-y-4 mb-12 opacity-0 animate-fade-up delay-300">
              {[
                "Treinamento prático do time",
                "Acompanhamento e cobrança contínua",
                "Quick wins no 1º mês (meta operacional)",
                "Payback projetado até o 3º mês (projeção, sem garantia)",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-4 text-foreground/90"
                >
                  <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4 opacity-0 animate-fade-up delay-400">
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
        
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Problem Section */}
      <section className="section-padding bg-background relative">
        <div className="absolute inset-0 bg-gradient-glow opacity-20 pointer-events-none" />
        
        <div className="container-premium relative">
          <div className="max-w-3xl mx-auto text-center mb-20">
            <h2 className="heading-section text-foreground mb-6">
              Seu problema de vendas não é esforço.
              <span className="block text-gradient-gold mt-2">É falta de direção.</span>
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
                className="card-premium p-6 group"
              >
                <div className="flex gap-4">
                  <div className="w-3 h-3 rounded-full bg-primary mt-1.5 flex-shrink-0 group-hover:animate-glow-pulse" />
                  <p className="text-foreground font-medium">{problem}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Product Highlight */}
      <section className="section-padding bg-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        
        <div className="container-premium relative">
          <div className="card-highlight p-8 md:p-12 lg:p-16 flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full text-primary text-sm font-medium mb-8">
                <Sparkles className="h-4 w-4" />
                Programa Principal
              </div>
              <h2 className="heading-section text-foreground mb-6">
                UNV Sales Acceleration
              </h2>
              <p className="text-body mb-8">
                Programa anual de direção comercial para treinar, acompanhar e
                acelerar seu time de vendas. De quick wins a crescimento
                sustentável, com cobrança total de execução.
              </p>
              <div className="text-3xl font-bold text-primary mb-8">
                R$ 24.000<span className="text-lg font-normal text-muted-foreground">/ano</span>
              </div>
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
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-gold opacity-20 blur-2xl rounded-3xl group-hover:opacity-30 transition-opacity duration-500" />
                <img
                  src={salesTeam}
                  alt="Time de vendas profissional em escritório moderno"
                  className="relative rounded-2xl shadow-2xl w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Ladder */}
      <section className="section-padding bg-background relative">
        <div className="container-premium">
          <div className="text-center mb-20">
            <h2 className="heading-section text-foreground mb-6">
              Encontre Seu Ponto de Entrada
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Cada empresa tem necessidades diferentes. Nossa escada de produtos
              te encontra onde você está e cresce com você.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product, index) => (
              <Link
                key={product.href}
                to={product.href}
                className={`group ${
                  product.highlight ? "card-highlight" : "card-premium"
                } p-6 block`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="heading-card text-foreground group-hover:text-primary transition-colors duration-300">
                    {product.name}
                  </h3>
                  {product.highlight && (
                    <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full">
                      Destaque
                    </span>
                  )}
                </div>
                <p className="text-body mb-4">{product.description}</p>
                <p className="text-small mb-2">ICP: {product.icp}</p>
                <p className="text-lg font-bold text-primary">{product.price}</p>
                <div className="mt-6 flex items-center text-primary text-sm font-semibold">
                  Saiba mais
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-2 transition-transform duration-300" />
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-16">
            <Link to="/products">
              <Button variant="premium-outline" size="lg">
                Ver Todos os Produtos
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CEO Section */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-12 items-center">
              <div className="lg:col-span-2 text-center">
                <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 mx-auto flex items-center justify-center border-4 border-primary/30">
                  <span className="text-6xl md:text-7xl font-display font-bold text-primary">FN</span>
                </div>
                <h3 className="text-2xl font-display font-bold text-foreground mt-6">
                  Fabrício Nunnes
                </h3>
                <p className="text-primary font-medium">CEO & Fundador da UNV</p>
              </div>
              
              <div className="lg:col-span-3">
                <h2 className="heading-section text-foreground mb-6">
                  Quem Está Por Trás da UNV
                </h2>
                <div className="space-y-4 text-body">
                  <p>
                    Empresário, mentor, diretor de vendas, criador da Universidade Nacional de Vendas. 
                    Com mais de <span className="text-foreground font-semibold">20 anos de experiência</span> na área 
                    e uma década como diretor comercial, atualmente atendo diversas empresas que faturam 
                    entre 6 a 7 dígitos todos os meses.
                  </p>
                  <p>
                    Durante minha carreira, alcancei a marca de mais de <span className="text-foreground font-semibold">1 bilhão em vendas</span> de 
                    serviços e produtos. Com toda a experiência adquirida, decidi focar o meu trabalho 
                    em empresários de pequenas e médias empresas que desejam escalar o seu negócio.
                  </p>
                  <p>
                    Minha principal missão é fazer com que cada um alcance suas metas regularmente, 
                    aumente seu faturamento e consiga estruturar um <span className="text-foreground font-semibold">negócio totalmente 
                    autogerenciável</span> que traz resultados exponenciais e mais qualidade de vida.
                  </p>
                </div>
                <div className="flex flex-wrap gap-6 mt-8">
                  <div className="text-center">
                    <p className="text-3xl font-display font-bold text-primary">20+</p>
                    <p className="text-small text-muted-foreground">Anos de experiência</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-display font-bold text-primary">R$ 1Bi+</p>
                    <p className="text-small text-muted-foreground">Em vendas realizadas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-display font-bold text-primary">10+</p>
                    <p className="text-small text-muted-foreground">Anos como diretor</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="section-padding bg-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-20 pointer-events-none" />
        
        <div className="container-premium relative">
          <div className="text-center mb-20">
            <h2 className="heading-section text-foreground mb-6">Como Começamos</h2>
            <p className="text-body max-w-2xl mx-auto">
              Um processo de onboarding estruturado garante que entendamos seu
              contexto antes de propor soluções.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {processSteps.map((step, i) => (
              <div key={i} className="text-center lg:text-left group">
                <div className="text-6xl font-display font-bold text-primary/20 mb-4 group-hover:text-primary/40 transition-colors duration-300">
                  {step.step}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-20">
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
