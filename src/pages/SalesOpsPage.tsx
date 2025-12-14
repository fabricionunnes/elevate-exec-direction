import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  Users2, 
  Shield, 
  MessageSquare, 
  BarChart,
  TrendingUp,
  FileText,
  Target,
  Sparkles,
  Layers,
  UserCheck,
  GraduationCap,
  ClipboardCheck
} from "lucide-react";
import salesOpsHero from "@/assets/sales-ops-hero.jpg";

const deliverables = [
  {
    icon: GraduationCap,
    title: "Trilhas por Cargo",
    description: "Treinamentos específicos para cada função do time comercial.",
    details: [
      "Trilha SDR completa",
      "Trilha Closer avançada",
      "Trilha Gestor estratégica",
      "Conteúdo atualizado constantemente"
    ]
  },
  {
    icon: MessageSquare,
    title: "Padronização do Discurso",
    description: "Scripts e roteiros padronizados por cargo e etapa do funil.",
    details: [
      "Scripts por cargo",
      "Roteiros por etapa",
      "Tratamento de objeções",
      "Padrão de comunicação"
    ]
  },
  {
    icon: ClipboardCheck,
    title: "Avaliações Individuais",
    description: "Sistema de avaliação para medir progresso e identificar gaps de cada membro.",
    details: [
      "Testes de conhecimento",
      "Avaliações práticas",
      "Feedback estruturado",
      "Plano de desenvolvimento"
    ]
  },
  {
    icon: BarChart,
    title: "Scorecards de Performance",
    description: "Métricas claras de performance para cada cargo e função.",
    details: [
      "KPIs por cargo",
      "Ranking de performance",
      "Metas individuais",
      "Comparativo de time"
    ]
  },
  {
    icon: FileText,
    title: "Relatórios de Performance",
    description: "Relatórios detalhados sobre o progresso e performance do time.",
    details: [
      "Relatório semanal",
      "Análise de evolução",
      "Identificação de gaps",
      "Recomendações de ação"
    ]
  },
  {
    icon: Sparkles,
    title: "Suporte IA por Cargo",
    description: "Assistência IA customizada para cada função, ajudando na execução diária.",
    details: [
      "IA para SDR",
      "IA para Closer",
      "IA para Gestor",
      "Suporte contextualizado"
    ]
  }
];

const tracks = [
  {
    role: "SDR",
    title: "Trilha SDR",
    description: "Prospecção, qualificação e agendamento",
    skills: [
      "Técnicas de prospecção",
      "Qualificação de leads",
      "Cadência de contato",
      "Agendamento eficiente"
    ],
    icon: Target
  },
  {
    role: "Closer",
    title: "Trilha Closer",
    description: "Diagnóstico, proposta e fechamento",
    skills: [
      "Diagnóstico de dor",
      "Apresentação de valor",
      "Tratamento de objeções",
      "Técnicas de fechamento"
    ],
    icon: UserCheck
  },
  {
    role: "Gestor",
    title: "Trilha Gestor",
    description: "Gestão, cobrança e desenvolvimento",
    skills: [
      "Gestão por indicadores",
      "Feedback efetivo",
      "Cobrança estruturada",
      "Desenvolvimento de time"
    ],
    icon: Users2
  }
];

const gains = [
  {
    icon: Layers,
    title: "Operações Padronizadas",
    description: "Time inteiro seguindo o mesmo processo e metodologia."
  },
  {
    icon: UserCheck,
    title: "Menor Dependência do Dono",
    description: "Time autônomo que executa sem supervisão constante."
  },
  {
    icon: TrendingUp,
    title: "Escala com Previsibilidade",
    description: "Crescer o time mantendo a qualidade e consistência."
  },
  {
    icon: GraduationCap,
    title: "Onboarding Escalável",
    description: "Novos vendedores produtivos em menos tempo."
  }
];

const icp = [
  { label: "Faturamento", value: "R$ 200k+/mês", icon: BarChart },
  { label: "Time", value: "5+ vendedores", icon: Users2 },
];

const notIncluded = [
  "Direção estratégica (veja Sales Acceleration ou Partners)",
  "Sessões de treinamento presencial",
  "Implementação ou gestão de CRM",
  "Contratação de vendedores"
];

export default function SalesOpsPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${salesOpsHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-block px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6 backdrop-blur-sm">
              Padronização de Times
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Sales Ops
            </h1>
            <p className="text-2xl md:text-3xl text-primary-foreground/90 font-medium mb-4">
              Padronizar e escalar times.
            </p>
            <p className="text-lg text-primary-foreground/70 mb-8 max-w-2xl">
              Padronize seu time comercial em escala. Trilhas de treinamento por
              cargo, scorecards e suporte IA para execução consistente em todo o time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/apply">
                <Button variant="hero" size="xl">
                  Aplicar Agora
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link to="/products">
                <Button variant="outline" size="xl" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                  Ver Todos os Produtos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Papel da UNV */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              O Papel da UNV no Sales Ops
            </h2>
            <p className="text-body text-lg max-w-2xl mx-auto mb-8">
              No Sales Ops, a UNV atua como plataforma de padronização e desenvolvimento, 
              garantindo que cada membro do time siga o mesmo padrão de excelência.
            </p>
            <div className="p-6 bg-accent/5 rounded-xl border border-accent/20">
              <p className="text-foreground font-medium text-lg">
                "Time padronizado escala. Time improvisado quebra."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Para Quem É
            </h2>
            <div className="grid sm:grid-cols-2 gap-8">
              {icp.map((item, i) => (
                <div key={i} className="card-premium p-8 text-center group hover:border-accent/50 transition-colors">
                  <div className="w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/20 transition-colors">
                    <item.icon className="h-8 w-8 text-accent" />
                  </div>
                  <p className="text-small uppercase tracking-wider mb-2 text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="font-semibold text-foreground text-2xl">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Trilhas por Cargo
            </h2>
            <p className="text-body text-lg max-w-2xl mx-auto">
              Cada função do time comercial tem uma trilha específica, 
              com conteúdo, avaliações e IA customizados.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {tracks.map((track, i) => (
              <div 
                key={i} 
                className="card-premium p-8 text-center group hover:border-accent/50 transition-all hover:shadow-lg"
              >
                <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-accent/20 transition-colors">
                  <track.icon className="h-10 w-10 text-accent" />
                </div>
                <p className="text-accent font-bold text-sm uppercase tracking-wider mb-2">
                  {track.role}
                </p>
                <h3 className="font-semibold text-foreground text-xl mb-2">
                  {track.title}
                </h3>
                <p className="text-body text-sm mb-6">
                  {track.description}
                </p>
                <ul className="space-y-2 text-left">
                  {track.skills.map((skill, j) => (
                    <li key={j} className="flex items-center gap-2 text-small">
                      <CheckCircle className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                      <span>{skill}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              O Que Você Recebe
            </h2>
            <p className="text-body text-lg max-w-2xl mx-auto">
              Tudo que você precisa para padronizar e desenvolver seu time comercial em escala.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {deliverables.map((item, i) => (
              <div 
                key={i} 
                className="card-premium p-6 bg-background group hover:border-accent/50 transition-all hover:shadow-lg"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <item.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground text-lg mb-2">
                  {item.title}
                </h3>
                <p className="text-body text-sm mb-4">
                  {item.description}
                </p>
                <ul className="space-y-2">
                  {item.details.map((detail, j) => (
                    <li key={j} className="flex items-center gap-2 text-small">
                      <CheckCircle className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Support */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="card-highlight p-8 lg:p-12">
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-20 h-20 rounded-2xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-10 w-10 text-accent" />
                </div>
                <div>
                  <h3 className="heading-card text-foreground mb-3">
                    Suporte IA Por Cargo
                  </h3>
                  <p className="text-body text-lg mb-6">
                    Cada cargo recebe assistência IA customizada para execução diária. 
                    O SDR tem suporte para prospecção, o Closer para fechamento, 
                    o Gestor para cobrança.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {["IA para SDR", "IA para Closer", "IA para Gestor"].map((ai, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 bg-background/50 rounded-lg">
                        <Sparkles className="h-4 w-4 text-accent" />
                        <span className="text-small font-medium">{ai}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gains */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Ganhos Esperados
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {gains.map((gain, i) => (
                <div key={i} className="text-center">
                  <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <gain.icon className="h-8 w-8 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground text-lg mb-2">
                    {gain.title}
                  </h3>
                  <p className="text-body text-sm">
                    {gain.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What's NOT Included */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              O Que NÃO Está Incluso
            </h2>
            <p className="text-body text-center mb-12">
              Sales Ops é para padronização de time. Para direção estratégica, combine com outros produtos.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {notIncluded.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 bg-secondary rounded-lg"
                >
                  <Shield className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-premium text-center">
          <h2 className="heading-section mb-6">Investimento</h2>
          <p className="text-5xl md:text-6xl font-display font-bold text-accent mb-4">
            R$ 97
          </p>
          <p className="text-primary-foreground/70 text-lg mb-4">
            Por usuário, por mês
          </p>
          <p className="text-primary-foreground/50 text-sm mb-10 max-w-md mx-auto">
            Escala de preços por volume. Quanto maior o time, menor o custo por usuário.
          </p>
          <Link to="/apply">
            <Button variant="hero" size="xl">
              Aplicar Agora
              <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Next Step */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-small uppercase tracking-wider text-muted-foreground mb-4">
              Quer direção estratégica também?
            </p>
            <h2 className="heading-section text-foreground mb-6">
              Combine com Sales Acceleration
            </h2>
            <p className="text-body text-lg mb-8 max-w-2xl mx-auto">
              Sales Ops padroniza o time. Sales Acceleration dá a direção estratégica. 
              Juntos, formam a estrutura completa para escalar.
            </p>
            <Link to="/sales-acceleration">
              <Button variant="premium" size="lg">
                Conhecer Sales Acceleration
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
