import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, MessageCircle, Sparkles, Quote, Star, Users, Target, Trophy, TrendingUp, Building2, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import heroBoardroom from "@/assets/hero-boardroom.jpg";
import salesTeam from "@/assets/sales-team.jpg";
import fabricioNunnes from "@/assets/fabricio-nunnes.png";

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
    description: "Direção estratégica elite + Experiência Mansão",
    icp: "R$ 300k–2M/mês",
    href: "/partners",
  },
  {
    name: "Sales Ops",
    description: "Padronização de times em escala",
    icp: "5+ vendedores",
    href: "/sales-ops",
  },
  {
    name: "UNV Ads",
    description: "Tráfego e geração de demanda qualificada",
    icp: "R$ 100k–1M+/mês",
    href: "/ads",
  },
  {
    name: "UNV Social",
    description: "Social media como canal de vendas",
    icp: "R$ 80k–1M+/mês",
    href: "/social",
  },
  {
    name: "UNV Mastermind",
    description: "Inner Circle de líderes empresariais",
    icp: "R$ 1M–10M/mês",
    href: "/mastermind",
    highlight: true,
  },
];

const testimonials = [
  {
    name: "Lucas Viana",
    company: "Pai do Tráfego",
    text: "O 'paizão' como é conhecido no mercado nacional, o maior player de cursos de gestão de tráfego e dono da maior agência de tráfego do Brasil tem nosso acompanhamento e mudou o resultado dele, mesmo já tendo uma estrutura robusta já funcionando ele escalou absurdamente seus resultados.",
    highlight: "Escalou absurdamente os resultados",
  },
  {
    name: "Dr. Luis Eduardo",
    company: "Clínica Main",
    text: "Triplicaram as vendas em 3 meses, com um resultado inacreditável em pouquíssimo tempo, sem precisar baixar preço, trabalhava para pagar contas somente e hoje está expandindo a empresa.",
    highlight: "Triplicou as vendas em 3 meses",
  },
  {
    name: "Andrea Silva",
    company: "Papelaria Print Point",
    text: "Andrea hoje consegue sair do operacional e a UNV foi um divisor de águas pra ela, que estava pensando se fechava a empresa ou fechava com a Universidade Vendas, fechou com nossa empresa e hoje está escalando forte e dobrando o resultado.",
    highlight: "Dobrou o resultado",
  },
  {
    name: "Ivânia",
    company: "Instituto Mix",
    text: "Ivânia saiu completamente do operacional para se tornar de fato uma empresária de sucesso. 'Tem dia que eu chego na unidade e penso, acho que vou embora porque não tem nada mais pra fazer'.",
    highlight: "Saiu do operacional",
  },
  {
    name: "Luis Fernando",
    company: "Marmoraria e Posto Shell",
    text: "No primeiro mês bateu recorde de vendas da história da empresa com mais de 7 anos no mercado.",
    highlight: "Recorde de vendas no 1º mês",
  },
  {
    name: "William",
    company: "LP Distribuidora",
    text: "Já fez outros treinamentos com os vendedores mas eles não engajavam, e agora com o Fabrício Nunnes como diretor comercial fez ele abrir novos horizontes.",
    highlight: "Time finalmente engajou",
  },
  {
    name: "Suave Estética",
    company: "Empresa de Estética",
    text: "A cliente dobrou suas vendas nos 3 primeiros meses, mesmo já tendo tido outros mentorados, com a Universidade Vendas ela conseguiu alavancar suas vendas consideravelmente.",
    highlight: "Dobrou vendas em 3 meses",
  },
  {
    name: "Fabiana",
    company: "Zziphus",
    text: "Em apenas dois meses os serviços da Universidade Nacional de Vendas já foram 100% pagos.",
    highlight: "ROI em 2 meses",
  },
  {
    name: "Fast Escova",
    company: "Franquia de Salão de Beleza",
    text: "Em apenas 2 meses conseguiu colocar 1 vendedora em segundo lugar da franquia na região e a franquia já está no TOP 5 de todas as franqueadoras no Brasil.",
    highlight: "TOP 5 Brasil em 2 meses",
  },
  {
    name: "Franciscarla",
    company: "Le Fran Perfumaria",
    text: "Na sua primeira ação já teve o investimento na Universidade Vendas pago, em menos de 15 dias.",
    highlight: "Payback em 15 dias",
  },
  {
    name: "Pedro",
    company: "Escola de Semijoias",
    text: "Com uma ação fez mais de 20 mil reais em vendas, apenas com o conteúdo gratuito ele já viu muito valor aumentando assim seu ticket médio de R$ 1.000 para R$ 3.000 no mesmo produto e criando outro produto de R$ 30.000.",
    highlight: "Ticket médio 3x maior",
  },
  {
    name: "Osvani",
    company: "Douramor Semijóias & JG Modas",
    text: "'Não é o valor que você paga, é o investimento que você faz na sua empresa e na sua vida'. 'A cabeça chega a explodir de tanta informação'.",
    highlight: "Transformação completa",
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

const stats = [
  { value: "20+", label: "Anos de experiência", icon: Award },
  { value: "R$ 1Bi+", label: "Em vendas realizadas", icon: TrendingUp },
  { value: "500+", label: "Empresas atendidas", icon: Building2 },
  { value: "10+", label: "Anos como diretor comercial", icon: Trophy },
];

export default function HomePage() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[100svh] flex items-center overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
        {/* Glow effect - hidden on mobile for performance */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-glow opacity-30 pointer-events-none" />

        <div className="container-premium relative z-10 py-20 sm:py-28 md:py-32">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 border border-primary/30 rounded-full text-primary text-xs sm:text-sm font-medium mb-6 sm:mb-8 opacity-0 animate-fade-up">
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
              Direção Comercial como Serviço
            </div>
            
            <h1 className="heading-display text-foreground mb-4 sm:mb-6 md:mb-8 opacity-0 animate-fade-up delay-100">
              Atuamos como seu{" "}
              <span className="text-gradient-red">Diretor Comercial.</span>
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-6 sm:mb-8 md:mb-10 max-w-2xl opacity-0 animate-fade-up delay-200">
              A UNV treina, acompanha e cobra seu time comercial para acelerar
              vendas com método e previsibilidade.
            </p>

            <ul className="space-y-2 sm:space-y-3 md:space-y-4 mb-8 sm:mb-10 md:mb-12 opacity-0 animate-fade-up delay-300">
              {[
                "Treinamento prático do time",
                "Acompanhamento e cobrança contínua",
                "Quick wins no 1º mês (meta operacional)",
                "Payback projetado até o 3º mês (projeção, sem garantia)",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-start sm:items-center gap-3 sm:gap-4 text-foreground/90 text-sm sm:text-base"
                >
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

             <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 opacity-0 animate-fade-up delay-400">
              <Link to="/apply" className="w-full sm:w-auto">
                <Button variant="hero" size="lg" className="w-full sm:w-auto text-sm sm:text-base">
                  Aplicar para Diagnóstico
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-8 sm:py-12 bg-card border-y border-border/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-20 pointer-events-none" />
        <div className="container-premium relative">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center group">
                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 border border-primary/30 mb-3 sm:mb-4 group-hover:bg-primary/20 transition-colors duration-300">
                  <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <p className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-primary mb-1">{stat.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About UNV Section */}
      <section className="section-padding bg-background relative">
        <div className="hidden sm:block absolute inset-0 bg-gradient-glow opacity-10 pointer-events-none" />
        
        <div className="container-premium relative">
          <div className="max-w-4xl mx-auto text-center mb-12 sm:mb-16">
            <h2 className="heading-section text-foreground mb-4 sm:mb-6">
              A Universidade Nacional de Vendas
            </h2>
            <p className="text-body text-sm sm:text-base md:text-lg mb-6 sm:mb-8">
              Não somos uma consultoria tradicional. Não vendemos teoria. 
              <span className="text-foreground font-semibold"> Somos diretores comerciais de verdade</span>, 
              que entram na operação, treinam o time, cobram execução e geram resultado.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
            <div className="card-premium p-6 sm:p-8 text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-primary/20 transition-colors duration-300">
                <Target className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3">Direção Comercial</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Assumimos a direção comercial da sua empresa como se fosse nossa. Cobrança, método e resultado.
              </p>
            </div>

            <div className="card-premium p-6 sm:p-8 text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-primary/20 transition-colors duration-300">
                <Users className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3">Treinamento Prático</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Treinamos seu time na prática, com scripts, roleplay e acompanhamento constante.
              </p>
            </div>

            <div className="card-premium p-6 sm:p-8 text-center group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-primary/20 transition-colors duration-300">
                <Trophy className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3">Resultado Real</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Nossos clientes batem metas, dobram vendas e saem do operacional. Isso é o que importa.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="section-padding bg-card relative">
        <div className="hidden sm:block absolute inset-0 bg-gradient-glow opacity-20 pointer-events-none" />
        
        <div className="container-premium relative">
          <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-16 md:mb-20">
            <h2 className="heading-section text-foreground mb-4 sm:mb-6">
              Seu problema de vendas não é esforço.
              <span className="block text-gradient-gold mt-1 sm:mt-2">É falta de direção.</span>
            </h2>
            <p className="text-body text-sm sm:text-base md:text-lg">
              Sem direção comercial adequada, até times talentosos performam
              abaixo do potencial. Esses sintomas podem parecer familiares:
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {problems.map((problem, i) => (
              <div
                key={i}
                className="card-premium p-4 sm:p-6 group"
              >
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-primary mt-1.5 flex-shrink-0 group-hover:animate-glow-pulse" />
                  <p className="text-foreground font-medium text-sm sm:text-base">{problem}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CEO Section - Expanded */}
      <section className="section-padding bg-background relative overflow-hidden">
        <div className="hidden sm:block absolute inset-0 bg-gradient-glow opacity-15 pointer-events-none" />
        
        <div className="container-premium relative">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
              {/* Image Column */}
              <div className="text-center lg:text-left order-first">
                <div className="relative group inline-block">
                  <div className="hidden sm:block absolute -inset-6 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-3xl rounded-full opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                  <div className="relative">
                    <img
                      src={fabricioNunnes}
                      alt="Fabrício Nunnes - CEO e Fundador da UNV"
                      className="relative w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full mx-auto lg:mx-0 object-cover border-4 border-primary/30 shadow-2xl"
                    />
                    <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-lg sm:text-2xl font-display font-bold text-primary">R$ 1Bi+</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">em vendas</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Content Column */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 border border-primary/30 rounded-full text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                  <Award className="h-3 w-3 sm:h-4 sm:w-4" />
                  Fundador & CEO
                </div>
                
                <h2 className="heading-section text-foreground mb-4 sm:mb-6">
                  Fabrício Nunnes
                </h2>
                
                <div className="space-y-4 sm:space-y-5 text-muted-foreground text-sm sm:text-base md:text-lg">
                  <p>
                    Empresário, mentor, diretor de vendas, criador da <span className="text-foreground font-semibold">Universidade Nacional de Vendas</span>. 
                    Com mais de <span className="text-foreground font-semibold">20 anos de experiência</span> na área 
                    e uma década como diretor comercial.
                  </p>
                  <p>
                    Durante minha carreira, alcancei a marca de mais de <span className="text-foreground font-semibold">1 bilhão em vendas</span> de 
                    serviços e produtos. Com toda a experiência adquirida, decidi focar o meu trabalho 
                    em empresários de pequenas e médias empresas que desejam escalar o seu negócio.
                  </p>
                  <p>
                    Atualmente atendo diversas empresas que faturam entre <span className="text-foreground font-semibold">6 a 7 dígitos todos os meses</span>. 
                    Minha principal missão é fazer com que cada um alcance suas metas regularmente, 
                    aumente seu faturamento e consiga estruturar um negócio totalmente autogerenciável.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-10">
                  <div className="text-center p-3 sm:p-4 bg-card rounded-xl border border-border/50">
                    <p className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-primary">20+</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Anos de experiência</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-card rounded-xl border border-border/50">
                    <p className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-primary">500+</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Empresas atendidas</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-card rounded-xl border border-border/50">
                    <p className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-primary">10+</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Anos como diretor</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="section-padding bg-card relative overflow-hidden">
        <div className="hidden sm:block absolute inset-0 bg-gradient-glow opacity-20 pointer-events-none" />
        
        <div className="container-premium relative">
          <div className="text-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 border border-primary/30 rounded-full text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6">
              <Star className="h-3 w-3 sm:h-4 sm:w-4" />
              Resultados Reais
            </div>
            <h2 className="heading-section text-foreground mb-4 sm:mb-6">
              Quem Aplica o Método <span className="text-gradient-red">Tem Esses Resultados</span>
            </h2>
            <p className="text-body text-sm sm:text-base md:text-lg max-w-2xl mx-auto">
              Empresários de diversos segmentos que confiaram na UNV e transformaram seus resultados comerciais.
            </p>
          </div>

          <div className="relative px-8 sm:px-12">
            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-4">
                {testimonials.map((testimonial, index) => (
                  <CarouselItem key={index} className="pl-4 md:basis-1/2 lg:basis-1/3">
                    <div className="card-premium p-5 sm:p-6 md:p-8 h-full flex flex-col">
                      <div className="mb-4">
                        <Quote className="h-8 w-8 sm:h-10 sm:w-10 text-primary/30" />
                      </div>
                      
                      <div className="mb-4">
                        <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs sm:text-sm font-semibold rounded-full">
                          {testimonial.highlight}
                        </span>
                      </div>
                      
                      <p className="text-foreground/80 text-sm sm:text-base flex-grow mb-6 leading-relaxed">
                        "{testimonial.text}"
                      </p>
                      
                      <div className="border-t border-border/50 pt-4 mt-auto">
                        <p className="font-bold text-foreground text-sm sm:text-base">{testimonial.name}</p>
                        <p className="text-muted-foreground text-xs sm:text-sm">{testimonial.company}</p>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden sm:flex -left-4" />
              <CarouselNext className="hidden sm:flex -right-4" />
            </Carousel>
          </div>

          <div className="text-center mt-10 sm:mt-12">
            <p className="text-muted-foreground text-sm sm:text-base mb-4">
              E muitos outros empresários transformando seus resultados todos os dias.
            </p>
            <Link to="/apply">
              <Button variant="premium" size="lg" className="text-sm sm:text-base">
                Quero Resultados Assim
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Product Highlight */}
      <section className="section-padding bg-background relative overflow-hidden">
        <div className="hidden sm:block absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        
        <div className="container-premium relative">
          <div className="card-highlight p-5 sm:p-8 md:p-12 lg:p-16 flex flex-col lg:flex-row gap-8 sm:gap-10 lg:gap-16 items-center">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 border border-primary/30 rounded-full text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6 md:mb-8">
                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                Programa Principal
              </div>
              <h2 className="heading-section text-foreground mb-4 sm:mb-6">
                UNV Sales Acceleration
              </h2>
              <p className="text-body text-sm sm:text-base md:text-lg mb-6 sm:mb-8">
                Programa anual de direção comercial para treinar, acompanhar e
                acelerar seu time de vendas. De quick wins a crescimento
                sustentável, com cobrança total de execução.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link to="/sales-acceleration" className="w-full sm:w-auto">
                  <Button variant="premium" size="default" className="w-full sm:w-auto text-sm sm:text-base">
                    Explorar Programa
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/apply" className="w-full sm:w-auto">
                  <Button variant="premium-outline" size="default" className="w-full sm:w-auto text-sm sm:text-base">
                    Aplicar Agora
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex-1 w-full lg:w-auto order-first lg:order-last">
              <div className="relative group">
                <div className="hidden sm:block absolute -inset-4 bg-gradient-gold opacity-20 blur-2xl rounded-3xl group-hover:opacity-30 transition-opacity duration-500" />
                <img
                  src={salesTeam}
                  alt="Time de vendas profissional em escritório moderno"
                  className="relative rounded-xl sm:rounded-2xl shadow-xl sm:shadow-2xl w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Ladder */}
      <section className="section-padding bg-card relative">
        <div className="container-premium">
          <div className="text-center mb-10 sm:mb-16 md:mb-20">
            <h2 className="heading-section text-foreground mb-4 sm:mb-6">
              Encontre Seu Ponto de Entrada
            </h2>
            <p className="text-body text-sm sm:text-base md:text-lg max-w-2xl mx-auto">
              Cada empresa tem necessidades diferentes. Nossa escada de produtos
              te encontra onde você está e cresce com você.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {products.map((product, index) => (
              <Link
                key={product.href}
                to={product.href}
                className={`group ${
                  product.highlight ? "card-highlight" : "card-premium"
                } p-4 sm:p-6 block`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2">
                  <h3 className="heading-card text-foreground group-hover:text-primary transition-colors duration-300">
                    {product.name}
                  </h3>
                  {product.highlight && (
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-primary/20 text-primary text-[10px] sm:text-xs font-semibold rounded-full flex-shrink-0">
                      Destaque
                    </span>
                  )}
                </div>
                <p className="text-body text-sm sm:text-base mb-3 sm:mb-4">{product.description}</p>
                <p className="text-small text-xs sm:text-sm">ICP: {product.icp}</p>
                <div className="mt-4 sm:mt-6 flex items-center text-primary text-xs sm:text-sm font-semibold">
                  Saiba mais
                  <ArrowRight className="ml-2 h-3 w-3 sm:h-4 sm:w-4 group-hover:translate-x-2 transition-transform duration-300" />
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10 sm:mt-12 md:mt-16">
            <Link to="/products">
              <Button variant="premium-outline" size="default" className="text-sm sm:text-base">
                Ver Todos os Produtos
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="section-padding bg-background relative overflow-hidden">
        <div className="hidden sm:block absolute inset-0 bg-gradient-glow opacity-20 pointer-events-none" />
        
        <div className="container-premium relative">
          <div className="text-center mb-10 sm:mb-16 md:mb-20">
            <h2 className="heading-section text-foreground mb-4 sm:mb-6">Como Começamos</h2>
            <p className="text-body text-sm sm:text-base md:text-lg max-w-2xl mx-auto">
              Um processo de onboarding estruturado garante que entendamos seu
              contexto antes de propor soluções.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            {processSteps.map((step, i) => (
              <div key={i} className="text-center lg:text-left group">
                <div className="text-4xl sm:text-5xl md:text-6xl font-display font-bold text-primary/20 mb-2 sm:mb-4 group-hover:text-primary/40 transition-colors duration-300">
                  {step.step}
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground mb-2 sm:mb-3">{step.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm md:text-base">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 sm:mt-12 md:mt-16">
            <Link to="/apply">
              <Button variant="hero" size="lg" className="text-sm sm:text-base">
                Aplicar para Diagnóstico
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20 md:py-24 bg-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        
        <div className="container-premium relative text-center">
          <h2 className="heading-section text-foreground mb-4 sm:mb-6 max-w-3xl mx-auto">
            Pronto para ter um <span className="text-gradient-red">Diretor Comercial</span> na sua empresa?
          </h2>
          <p className="text-body text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-8 sm:mb-10">
            Aplique agora para um diagnóstico gratuito e descubra como podemos acelerar suas vendas.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/apply">
              <Button variant="hero" size="xl" className="w-full sm:w-auto text-sm sm:text-base">
                Quero Aplicar Agora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
