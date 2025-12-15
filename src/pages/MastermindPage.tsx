import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  XCircle,
  Crown,
  Users2,
  Target,
  MessageSquare,
  Sparkles,
  Calendar,
  Home,
  Brain,
  Shield,
  Star,
  Lock,
  Zap,
  TrendingUp,
  FileText,
  Search,
  Phone,
  Award,
  Clock,
  UserCheck,
  AlertTriangle
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";

const pillars = [
  {
    title: "Sessões de Mastermind (Core)",
    description: "O núcleo do programa.",
    frequency: "1 encontro mensal ao vivo (online)",
    items: [
      "2 a 3 empresários em hot seat por encontro",
      "Contexto real do negócio",
      "Números abertos",
      "Decisão crítica em pauta",
      "Questionamento do grupo",
      "Direcionamento final do chairman"
    ],
    deliverables: [
      "Direcionamento estratégico",
      "Hipóteses claras",
      "Próximas decisões definidas"
    ],
    gain: "Eu penso melhor porque sou confrontado por quem vive o mesmo jogo.",
    icon: Brain
  },
  {
    title: "Mansão Empresarial",
    description: "O coração emocional e estratégico do Mastermind.",
    frequency: "Encontros mensais presenciais",
    items: [
      "Até 5 empresários por vez",
      "Ambiente privado (na Mansão)",
      "Sem palco, sem plateia, sem gravação",
      "Discussão profunda de negócios",
      "Decisões reais",
      "Conversas que não cabem em público"
    ],
    deliverables: [
      "Construção de confiança",
      "Confidencialidade total",
      "Curadoria pessoal"
    ],
    gain: "Aqui eu falo o que não falo em lugar nenhum.",
    icon: Home
  },
  {
    title: "Board Estratégico Coletivo",
    description: "Um board expandido, usando a inteligência coletiva.",
    frequency: "Discussões contínuas",
    items: [
      "Temas: crescimento, estrutura, pessoas, risco, patrimônio",
      "Benchmark real (números, não achismo)",
      "Padrões de decisão identificados",
      "Alertas de risco compartilhados"
    ],
    deliverables: [
      "Insights aplicáveis",
      "Padrões de decisão",
      "Alertas de risco"
    ],
    gain: "Eu evito erros que outros já cometeram.",
    icon: Users2
  },
  {
    title: "Direção Individual (Limitada)",
    description: "Acesso direto ao Fabrício para decisões críticas.",
    frequency: "2 sessões por ano",
    items: [
      "Foco em decisões críticas",
      "Momentos de transição",
      "Reestruturação de rota",
      "Não é mentoria recorrente"
    ],
    deliverables: [
      "Clareza em momentos-chave",
      "Direcionamento personalizado"
    ],
    gain: "Tenho acesso direto quando a decisão é grande demais.",
    icon: Target
  },
  {
    title: "UNV AI Advisor (Nível Mastermind)",
    description: "Extensão cognitiva do empresário.",
    frequency: "Suporte contínuo",
    items: [
      "Organiza decisões tomadas",
      "Registra aprendizados",
      "Ajuda a refletir antes de decisões grandes",
      "Prepara pautas para encontros"
    ],
    deliverables: [
      "Clareza entre encontros",
      "Histórico de decisões",
      "Preparação para sessões"
    ],
    gain: "Não substitui o grupo. Ela sustenta clareza entre encontros.",
    icon: Sparkles
  }
];

const deliverables = [
  "Sessões mensais de mastermind",
  "Hot seats estratégicos",
  "Mansão Empresarial mensal",
  "Board coletivo",
  "Direção individual pontual",
  "Benchmark real",
  "UNV AI Advisor avançado",
  "Comunidade ultra seletiva"
];

const exclusiveExperiences = [
  "Jantares fechados",
  "Convidados estratégicos (empresários reais)",
  "Discussões off-the-record",
  "Conteúdos que não são gravados",
  "Acesso antecipado a novas teses da UNV"
];

const immediateGains = [
  "Clareza nas decisões",
  "Alívio da solidão empresarial",
  "Decisões mais seguras"
];

const mediumTermGains = [
  "Menos erros caros",
  "Crescimento com critério",
  "Evolução pessoal como líder"
];

const longTermGains = [
  "Negócios mais sólidos",
  "Patrimônio protegido",
  "Visão de longo prazo"
];

const notIncluded = [
  "Não é curso",
  "Não é mentoria de vendas",
  "Não é grupo de WhatsApp",
  "Não é palco para ego",
  "Não é aberto ao público"
];

export default function MastermindPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[80vh] flex items-center overflow-hidden hero-dark">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/90 via-[hsl(214,65%,12%)] to-[hsl(214,65%,10%)]" />
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        
        <div className="container-premium relative z-10 py-32">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-sm font-medium mb-8 animate-fade-up">
              <Crown className="h-4 w-4" />
              The Inner Circle of Commercial & Business Leaders
            </div>
            
            <h1 className="heading-display hero-title mb-6 animate-fade-up delay-100">
              UNV Mastermind
            </h1>
            
            <p className="text-2xl md:text-3xl hero-description mb-6 animate-fade-up delay-200">
              O ambiente máximo de{" "}
              <span className="hero-title font-semibold">decisão, crescimento e visão estratégica.</span>
            </p>
            
            <p className="text-lg hero-description mb-10 max-w-2xl animate-fade-up delay-300">
              Empresários em estágio avançado, pensando, decidindo e evoluindo em nível que não acontece 
              em nenhum outro lugar. Um conselho vivo de empresários que jogam o mesmo jogo.
            </p>

            <div className="flex flex-wrap gap-6 mb-10 animate-fade-up delay-400">
              <div className="flex items-center gap-2 text-amber-400">
                <Lock className="h-5 w-5" />
                <span className="font-medium">Vagas extremamente limitadas</span>
              </div>
              <div className="flex items-center gap-2 text-amber-400">
                <Shield className="h-5 w-5" />
                <span className="font-medium">Entrada apenas por curadoria</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 animate-fade-up delay-500">
              <Link to="/apply">
                <Button variant="hero" size="xl" className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700">
                  Candidatar-se ao Mastermind
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/compare">
                <Button variant="hero-outline" size="xl">
                  Comparar Produtos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trail Summary */}
      <ProductTrailSummary
        color="gold"
        productNumber={10}
        productName="UNV MASTERMIND"
        tagline="Produto Máximo"
        whatItDoes="É o topo intelectual e estratégico da UNV."
        keyPoints={[
          "Sessões mensais",
          "Hot seats",
          "Mansão Empresarial",
          "Board coletivo",
          "Direção individual limitada"
        ]}
        arrow="Onde empresários param de crescer sozinhos."
        targetAudience={{
          revenue: "R$ 300k a R$ 3M/mês"
        }}
        schedule={[
          { period: "Mensal", description: "Mastermind" },
          { period: "Mensal", description: "Mansão" },
          { period: "Anual", description: "Direção individual" }
        ]}
        scheduleType="recurring"
      />

      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">
              O Que é o UNV Mastermind
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-xl">
                <XCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <p className="text-foreground font-semibold">Não é mentoria</p>
              </div>
              <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-xl">
                <XCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <p className="text-foreground font-semibold">Não é consultoria</p>
              </div>
              <div className="p-6 bg-destructive/10 border border-destructive/30 rounded-xl">
                <XCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <p className="text-foreground font-semibold">Não é networking frouxo</p>
              </div>
            </div>

            <div className="p-8 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
              <Crown className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <p className="text-2xl text-foreground font-bold">
                É um conselho vivo de empresários que jogam o mesmo jogo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* UNV Role */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground mb-8 text-center">
              O Papel da UNV no Mastermind
            </h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {[
                { title: "Chairman do Grupo", desc: "Liderança e condução" },
                { title: "Curador de Debates", desc: "Discussões de alto nível" },
                { title: "Provocador Estratégico", desc: "Perguntas que incomodam" },
                { title: "Moderador de Verdades", desc: "Conflitos e realidades difíceis" },
                { title: "Guardião do Nível", desc: "Qualidade do grupo" }
              ].map((role, i) => (
                <div key={i} className="card-premium p-6">
                  <h3 className="font-semibold text-foreground mb-2">{role.title}</h3>
                  <p className="text-sm text-muted-foreground">{role.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <p className="text-center text-muted-foreground">
                <span className="text-amber-400 font-semibold">⚠️ Importante:</span> A UNV não executa, não gere empresas, 
                não substitui liderança. <span className="text-foreground font-semibold">Ela eleva o nível das decisões.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-12 text-center">
            Perfil do Membro Ideal
          </h2>
          
          <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="card-premium p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Star className="h-6 w-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Perfil Ideal</h3>
              </div>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Faturamento <span className="text-foreground font-semibold">R$ 300k a R$ 3M/mês</span></span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground"><span className="text-foreground font-semibold">Donos reais</span> (não operadores)</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Já passaram por caos, crescimento, decisões difíceis</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Buscam clareza, visão de longo prazo, pares à altura</span>
                </li>
              </ul>
            </div>

            <div className="card-premium p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Perfil Comportamental</h3>
              </div>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Maturidade emocional</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Capacidade de ouvir verdades</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Disposição para contribuir</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Mentalidade de construção</span>
                </li>
              </ul>
            </div>

            <div className="card-premium p-8 border-destructive/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Não é Para</h3>
              </div>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Quem quer execução</span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Quem quer fórmula pronta</span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Quem busca palco</span>
                </li>
                <li className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Quem não compartilha números reais</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Objective */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              Objetivo Central
            </h2>
            <p className="text-2xl text-muted-foreground mb-8">
              Ajudar empresários a tomar <span className="text-foreground font-semibold">decisões melhores, mais rápidas 
              e com menos risco</span>, enquanto constroem negócios sólidos e vida equilibrada.
            </p>
            
            <div className="p-8 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
              <p className="text-xl text-foreground font-bold">
                O foco não é só vender mais. É crescer certo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-4 text-center">
            Os 5 Pilares do Mastermind
          </h2>
          <p className="text-body text-center mb-12 max-w-2xl mx-auto">
            Arquitetura completa para decisões de alto nível.
          </p>

          <div className="space-y-8">
            {pillars.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <div key={index} className="card-premium p-8">
                  <div className="flex items-start gap-6">
                    <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-7 w-7 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-4 mb-2">
                        <h3 className="text-xl font-bold text-foreground">
                          Pilar {index + 1} — {pillar.title}
                        </h3>
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-sm font-medium rounded-full">
                          {pillar.frequency}
                        </span>
                      </div>
                      <p className="text-muted-foreground mb-6">{pillar.description}</p>
                      
                      <div className="grid lg:grid-cols-3 gap-6">
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3">Estrutura</h4>
                          <ul className="space-y-2">
                            {pillar.items.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-3">Entregáveis</h4>
                          <ul className="space-y-2">
                            {pillar.deliverables.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="lg:col-span-1">
                          <h4 className="text-sm font-semibold text-foreground mb-3">Ganho</h4>
                          <p className="text-sm text-amber-400 font-medium italic">"{pillar.gain}"</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Exclusive Experiences */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground mb-8 text-center">
              Experiências Exclusivas
            </h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {exclusiveExperiences.map((exp, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <Star className="h-5 w-5 text-amber-400 flex-shrink-0" />
                  <span className="text-foreground font-medium">{exp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-12 text-center">
            Entregáveis Consolidados
          </h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {deliverables.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-secondary rounded-xl">
                <CheckCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                <span className="text-foreground font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gains */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground mb-12 text-center">
            Ganhos Reais
          </h2>
          
          <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="card-premium p-8">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Zap className="h-6 w-6 text-amber-400" />
                Imediatos
              </h3>
              <ul className="space-y-3">
                {immediateGains.map((gain, i) => (
                  <li key={i} className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-accent" />
                    {gain}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-premium p-8">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-amber-400" />
                Médio Prazo
              </h3>
              <ul className="space-y-3">
                {mediumTermGains.map((gain, i) => (
                  <li key={i} className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-accent" />
                    {gain}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-premium p-8">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
                <Shield className="h-6 w-6 text-amber-400" />
                Longo Prazo
              </h3>
              <ul className="space-y-3">
                {longTermGains.map((gain, i) => (
                  <li key={i} className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-accent" />
                    {gain}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* What It Is Not */}
      <section className="section-padding bg-card border-y border-border/30">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground mb-8 text-center">
              O Que o UNV Mastermind Não É
            </h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {notIncluded.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
                  <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
            
            <p className="text-center text-xl text-foreground font-semibold">
              👉 Ele é ambiente de decisão.
            </p>
          </div>
        </div>
      </section>

      {/* Curation Section */}
      <section className="section-padding bg-gradient-to-br from-amber-950/30 via-background to-background border-t border-border/30">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-sm font-medium mb-6">
                <Crown className="h-4 w-4" />
                Curadoria de Entrada
              </div>
              <h2 className="heading-section text-foreground mb-4">
                Nem todo empresário está pronto para um ambiente de decisão
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                O UNV Mastermind existe para quem já entende que <span className="text-foreground font-semibold">crescer sozinho custa caro.</span>
              </p>
            </div>

            {/* Principle */}
            <div className="card-premium p-8 mb-12 border-amber-500/30">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-7 w-7 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-4">Princípio da Curadoria</h3>
                  <p className="text-muted-foreground mb-6">
                    A curadoria do UNV Mastermind <span className="text-foreground font-semibold">não é baseada apenas em faturamento.</span> Ela avalia maturidade, postura e capacidade de contribuição.
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {["Proteger o nível do grupo", "Garantir trocas reais", "Evitar ruído, ego e curiosos", "Manter confidencialidade"].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-accent flex-shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <p className="text-amber-400 font-semibold text-center">
                      ⚠️ Um membro errado estraga o grupo inteiro.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Eligibility Criteria */}
            <div className="grid lg:grid-cols-2 gap-8 mb-12">
              <div className="card-premium p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Target className="h-6 w-6 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Critérios Objetivos</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">O candidato precisa atender <span className="text-foreground font-semibold">TODOS:</span></p>
                <ul className="space-y-3">
                  {[
                    "Faturamento mínimo: R$ 300k/mês",
                    "É dono ou sócio decisor",
                    "Tem estrutura mínima de operação",
                    "Está disposto a compartilhar números reais",
                    "Consegue comparecer aos encontros"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-premium p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Critérios Comportamentais</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">O candidato <span className="text-foreground font-semibold">não pode falhar em:</span></p>
                <ul className="space-y-3">
                  {[
                    "Abertura para feedback direto",
                    "Capacidade de ouvir sem defensividade",
                    "Disposição para contribuir com o grupo",
                    "Maturidade emocional",
                    "Postura de construção, não de palco"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Process Steps */}
            <div className="mb-12">
              <h3 className="text-2xl font-bold text-foreground mb-8 text-center">Etapas do Processo de Curadoria</h3>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Step 1 */}
                <div className="card-premium p-6 relative">
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm">
                    1
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4 mt-2">
                    <FileText className="h-6 w-6 text-amber-400" />
                  </div>
                  <h4 className="font-bold text-foreground mb-2">Aplicação Formal</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    O candidato preenche um formulário de aplicação (não é lead form).
                  </p>
                  <p className="text-xs text-amber-400 font-medium">
                    📌 Aplicação não garante vaga.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="card-premium p-6 relative">
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm">
                    2
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4 mt-2">
                    <Search className="h-6 w-6 text-amber-400" />
                  </div>
                  <h4 className="font-bold text-foreground mb-2">Análise Interna</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    A equipe UNV avalia nível do negócio, coerência, clareza e fit com o grupo.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    👉 Nessa etapa, a maioria é recusada sem call.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="card-premium p-6 relative">
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm">
                    3
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4 mt-2">
                    <Phone className="h-6 w-6 text-amber-400" />
                  </div>
                  <h4 className="font-bold text-foreground mb-2">Conversa de Curadoria</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Avaliar maturidade, reação a provocações, abertura a contrapontos.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Não é call de vendas. É leitura humana e estratégica.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="card-premium p-6 relative">
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm">
                    4
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4 mt-2">
                    <Award className="h-6 w-6 text-amber-400" />
                  </div>
                  <h4 className="font-bold text-foreground mb-2">Decisão Final</h4>
                  <div className="space-y-1 text-sm mb-3">
                    <p className="text-accent">✅ Aceito → convite formal</p>
                    <p className="text-amber-400">⏳ Lista de espera → maturação</p>
                    <p className="text-destructive">❌ Recusado → outro produto</p>
                  </div>
                  <p className="text-xs text-amber-400 font-medium">
                    📌 A decisão é soberana. Não há negociação.
                  </p>
                </div>
              </div>
            </div>

            {/* Refusal Criteria & Waitlist */}
            <div className="grid lg:grid-cols-2 gap-8 mb-12">
              <div className="card-premium p-8 border-destructive/30">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Critérios de Recusa</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Um candidato pode ser recusado se:</p>
                <ul className="space-y-2">
                  {[
                    "Busca palco ou validação",
                    "Não compartilha números",
                    "Demonstra rigidez excessiva",
                    "Quer execução terceirizada",
                    "Busca 'fórmula pronta'",
                    "Não respeita confidencialidade",
                    "Não tem tempo real para participar"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <p className="text-sm text-destructive font-semibold text-center">
                    📌 Dinheiro não compra vaga.
                  </p>
                </div>
              </div>

              <div className="card-premium p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Lista de Espera</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">A lista de espera existe quando:</p>
                <ul className="space-y-3 mb-6">
                  {[
                    "O grupo está completo",
                    "O candidato tem potencial",
                    "Mas ainda não é o momento ideal"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  Nesses casos, o candidato é avisado, recebe direcionamento e pode ser reavaliado futuramente.
                </p>
              </div>
            </div>

            {/* Permanence Rules */}
            <div className="card-premium p-8 mb-12 border-amber-500/30">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-7 w-7 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-4">Regras de Permanência</h3>
                  <p className="text-muted-foreground mb-6">
                    A curadoria <span className="text-foreground font-semibold">não termina na entrada.</span> Motivos para desligamento:
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {[
                      "Quebra de confidencialidade",
                      "Postura desrespeitosa",
                      "Falta recorrente",
                      "Uso do grupo para autopromoção",
                      "Desalinhamento com os valores"
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl">
                    <p className="text-destructive font-semibold text-center text-sm">
                      ⚠️ A UNV pode encerrar a participação sem reembolso.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Final Message */}
            <div className="text-center p-8 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
              <Crown className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <p className="text-2xl md:text-3xl text-foreground font-bold mb-4">
                O UNV Mastermind não aceita todos — e é exatamente por isso que funciona.
              </p>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Preencher a aplicação não garante vaga. Nosso objetivo é manter um ambiente de decisão seguro, profundo e de alto nível.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-2xl mx-auto">
            <div className="card-highlight p-8 md:p-12 text-center">
              <Crown className="h-16 w-16 text-amber-400 mx-auto mb-6" />
              <h2 className="heading-section text-foreground mb-4">Investimento</h2>
              <div className="text-5xl font-bold text-amber-400 mb-2">
                R$ 36.000<span className="text-lg font-normal text-muted-foreground">/ano</span>
              </div>
              <p className="text-muted-foreground mb-8">
                Pagamento anual ou parcelado
              </p>
              
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-full">
                  <Lock className="h-4 w-4" />
                  <span className="font-medium">Curadoria obrigatória</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-full">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Vagas limitadas</span>
                </div>
              </div>

              <Link to="/apply">
                <Button variant="premium" size="xl" className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700">
                  Candidatar-se ao Mastermind
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final Quote */}
      <section className="section-padding bg-gradient-to-br from-amber-900/40 via-background to-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <blockquote className="text-3xl md:text-4xl font-display font-bold text-foreground mb-8">
              "UNV Mastermind é onde empresários param de crescer sozinhos."
            </blockquote>
            <Link to="/apply">
              <Button variant="hero" size="xl" className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700">
                Iniciar Processo de Curadoria
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
