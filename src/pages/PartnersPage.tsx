import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  Crown, 
  Shield, 
  MessageSquare, 
  Users, 
  Home,
  Calendar,
  BarChart3,
  TrendingUp,
  Sparkles,
  Star,
  Globe
} from "lucide-react";
import partnersHero from "@/assets/partners-hero.jpg";
import mansionImage from "@/assets/mansion-experience.jpg";

const deliverables = [
  {
    icon: Calendar,
    title: "Board Mensal Estratégico",
    description: "Reunião mensal de board com revisão estratégica profunda e definição de prioridades.",
    details: [
      "Revisão de números e indicadores",
      "Análise de oportunidades",
      "Definição de prioridades",
      "Decisões estratégicas"
    ]
  },
  {
    icon: MessageSquare,
    title: "Acompanhamento Semanal",
    description: "Check-ins semanais para garantir que as decisões do board estão sendo executadas.",
    details: [
      "Cobrança de execução",
      "Resolução de bloqueios",
      "Ajustes táticos",
      "Suporte contínuo"
    ]
  },
  {
    icon: BarChart3,
    title: "Benchmark Estruturado",
    description: "Comparativo anonimizado com outras empresas do grupo para identificar oportunidades.",
    details: [
      "Métricas comparativas",
      "Best practices do grupo",
      "Identificação de gaps",
      "Oportunidades de melhoria"
    ]
  },
  {
    icon: Globe,
    title: "Eventos Presenciais Exclusivos",
    description: "Encontros presenciais com outros membros Partners para networking e troca estratégica.",
    details: [
      "Networking de alto nível",
      "Discussões estratégicas",
      "Parcerias potenciais",
      "Aprendizado entre pares"
    ]
  },
  {
    icon: Sparkles,
    title: "UNV AI Advisor — Nível Estratégico",
    description: "IA de suporte aprimorada para preparação estratégica e frameworks de decisão.",
    details: [
      "Preparação de reuniões",
      "Briefings estratégicos",
      "Frameworks de decisão",
      "Organização de prioridades"
    ]
  }
];

const mansionExperience = [
  {
    icon: Crown,
    title: "Curadoria Pessoal",
    description: "Seleção cuidadosa de participantes para garantir qualidade das interações."
  },
  {
    icon: Users,
    title: "Networking de Elite",
    description: "Conexões com empresários do mesmo nível de maturidade e ambição."
  },
  {
    icon: Star,
    title: "Decisões Reais",
    description: "Ambiente propício para discussões estratégicas profundas."
  },
  {
    icon: Calendar,
    title: "Encontros Recorrentes",
    description: "Acesso contínuo à experiência mansão como membro Partners."
  }
];

const gains = [
  {
    icon: TrendingUp,
    title: "Decisões Melhores",
    description: "Mentoria de pares que desafia e refina seu pensamento estratégico."
  },
  {
    icon: Users,
    title: "Menos Solidão",
    description: "Comunidade de empresários que entendem seus desafios."
  },
  {
    icon: BarChart3,
    title: "Crescimento com Critério",
    description: "Escalar com método, não com caos."
  }
];

const icp = [
  { label: "Faturamento", value: "R$ 300k–2M/mês", icon: BarChart3 },
];

const notIncluded = [
  "Treinamento operacional de time (veja Sales Acceleration)",
  "Gestão de CRM ou implementação de tecnologia",
  "Garantia de resultados de faturamento",
  "Custos de viagem e hospedagem da Mansão"
];

export default function PartnersPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${partnersHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6 backdrop-blur-sm">
              <Crown className="h-4 w-4" />
              Elite Estratégico
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Partners
            </h1>
            <p className="text-2xl md:text-3xl text-primary-foreground/90 font-medium mb-4">
              Board estratégico recorrente.
            </p>
            <p className="text-lg text-primary-foreground/70 mb-8 max-w-2xl">
              Mentoria elite para empresas estabelecidas. Reuniões de board mensais, 
              cobrança semanal, eventos exclusivos e a Experiência Mansão.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/apply">
                <Button variant="hero" size="xl">
                  Aplicar para Membership
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
              O Papel da UNV no Partners
            </h2>
            <p className="text-body text-lg max-w-2xl mx-auto mb-8">
              No Partners, a UNV atua como seu board advisor, 
              trazendo visão externa, cobrança e acesso a uma rede de empresários de elite.
            </p>
            <div className="p-6 bg-accent/5 rounded-xl border border-accent/20">
              <p className="text-foreground font-medium text-lg">
                "Crescer sozinho é possível. Crescer com pares de alto nível é mais rápido e menos arriscado."
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
            <div className="card-premium p-8 text-center border-accent/30">
              <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Crown className="h-10 w-10 text-accent" />
              </div>
              <p className="text-small uppercase tracking-wider mb-2 text-muted-foreground">
                Faturamento
              </p>
              <p className="font-semibold text-foreground text-4xl mb-4">
                R$ 300k–2M/mês
              </p>
              <p className="text-body max-w-md mx-auto">
                Empresas estabelecidas que buscam visão estratégica de alto nível, 
                networking qualificado e acesso a um grupo seleto de empresários.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              O Que Você Recebe
            </h2>
            <p className="text-body text-lg max-w-2xl mx-auto">
              Uma experiência completa de board estratégico com acompanhamento 
              contínuo e acesso a uma rede exclusiva.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {deliverables.map((item, i) => (
              <div 
                key={i} 
                className="card-premium p-6 group hover:border-accent/50 transition-all hover:shadow-lg"
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

      {/* Mansion Experience */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-6xl mx-auto">
            <div className="card-highlight overflow-hidden">
              <div className="grid lg:grid-cols-2">
                <div className="p-8 lg:p-12">
                  <div className="flex items-center gap-3 mb-6">
                    <Home className="h-8 w-8 text-accent" />
                    <h2 className="heading-card text-foreground text-2xl">
                      Experiência Mansão
                    </h2>
                  </div>
                  <p className="text-body text-lg mb-8">
                    Encontros presenciais exclusivos e recorrentes para membros Partners.
                    Conversas estratégicas em ambiente intimista, longe do barulho das operações diárias.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-6">
                    {mansionExperience.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                          <item.icon className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">{item.title}</h4>
                          <p className="text-small">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 p-4 bg-background/50 rounded-lg">
                    <p className="text-small text-muted-foreground">
                      Todos os custos (viagem, hospedagem, atividades) são por conta do cliente.
                      Vagas limitadas com processo de seleção.
                    </p>
                  </div>
                </div>
                <div className="relative min-h-[400px] lg:min-h-0">
                  <img
                    src={mansionImage}
                    alt="Experiência Mansão UNV Partners"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent lg:bg-gradient-to-l" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gains */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Ganhos Esperados
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {gains.map((gain, i) => (
                <div key={i} className="text-center">
                  <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <gain.icon className="h-10 w-10 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground text-xl mb-2">
                    {gain.title}
                  </h3>
                  <p className="text-body">
                    {gain.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What's NOT Included */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              O Que NÃO Está Incluso
            </h2>
            <p className="text-body text-center mb-12">
              Partners é estratégico. Para operação de time, combine com Sales Acceleration.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {notIncluded.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 bg-background rounded-lg"
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
            R$ 3.000 – R$ 6.000
          </p>
          <p className="text-primary-foreground/70 text-lg mb-4">
            Por mês • Aplicação e seleção necessárias
          </p>
          <p className="text-primary-foreground/50 text-sm mb-10 max-w-md mx-auto">
            Vagas limitadas. Processo seletivo para garantir qualidade do grupo.
          </p>
          <Link to="/apply">
            <Button variant="hero" size="xl">
              Aplicar para Membership
              <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
