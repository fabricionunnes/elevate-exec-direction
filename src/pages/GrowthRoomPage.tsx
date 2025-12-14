import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  MapPin, 
  Shield, 
  Calendar, 
  Target, 
  MessageSquare,
  FileText,
  BarChart3,
  Users,
  Clock,
  Sparkles,
  Zap,
  TrendingUp
} from "lucide-react";
import growthRoomHero from "@/assets/growth-room-hero.jpg";

const deliverables = [
  {
    icon: FileText,
    title: "Diagnóstico Prévio Detalhado",
    description: "Antes da imersão, fazemos uma análise profunda da sua operação para otimizar os 3 dias.",
    details: [
      "Análise de funil atual",
      "Mapeamento de gargalos",
      "Revisão de números históricos",
      "Definição de prioridades"
    ]
  },
  {
    icon: Calendar,
    title: "3 Dias de Imersão Presencial",
    description: "Sessões intensivas presenciais focadas em redesenhar sua operação comercial.",
    details: [
      "Dia 1: Diagnóstico e Funil",
      "Dia 2: Processos e Metas",
      "Dia 3: Plano de Execução",
      "Dinâmicas práticas e hands-on"
    ]
  },
  {
    icon: Layers,
    title: "Funil Completo Estruturado",
    description: "Saída com um funil comercial completo, com todas as etapas, critérios e métricas definidas.",
    details: [
      "Etapas do funil definidas",
      "Critérios de passagem",
      "Scripts por etapa",
      "Métricas de acompanhamento"
    ]
  },
  {
    icon: Target,
    title: "Metas e KPIs Definidos",
    description: "Metas claras para cada vendedor e indicadores-chave para acompanhar o progresso.",
    details: [
      "Meta por vendedor",
      "KPIs de atividade",
      "KPIs de conversão",
      "Dashboard de acompanhamento"
    ]
  },
  {
    icon: FileText,
    title: "Plano de 90 Dias Fechado",
    description: "Um roadmap detalhado do que fazer nos próximos 90 dias após a imersão.",
    details: [
      "Semana a semana planejada",
      "Milestones definidos",
      "Responsáveis atribuídos",
      "Checkpoints de validação"
    ]
  },
  {
    icon: Clock,
    title: "Pós-Imersão: Checkpoints",
    description: "Acompanhamento pós-imersão para garantir que o plano está sendo executado.",
    details: [
      "Check-ins periódicos",
      "Ajustes de rota",
      "Suporte a dúvidas",
      "AI Advisor configurado"
    ]
  }
];

const agenda = [
  {
    day: "Dia 1",
    title: "Diagnóstico & Funil",
    description: "Entendimento profundo da situação atual e construção do funil ideal.",
    items: ["Análise da operação", "Definição de funil", "Mapeamento de gargalos"]
  },
  {
    day: "Dia 2",
    title: "Processos & Metas",
    description: "Estruturação de processos e definição de metas realistas.",
    items: ["Scripts e roteiros", "Definição de metas", "KPIs de acompanhamento"]
  },
  {
    day: "Dia 3",
    title: "Plano de Execução",
    description: "Construção do plano de 90 dias e configuração de ferramentas.",
    items: ["Roadmap de 90 dias", "AI Advisor setup", "Próximos passos claros"]
  }
];

const gains = [
  {
    icon: Zap,
    title: "Direção Clara e Foco",
    description: "Sair da imersão sabendo exatamente o que fazer e em que ordem."
  },
  {
    icon: FileText,
    title: "Plano Executável",
    description: "Um plano que você leva pronto, não apenas ideias soltas."
  },
  {
    icon: Users,
    title: "Alinhamento Total",
    description: "Dono e time saem alinhados sobre prioridades e responsabilidades."
  },
  {
    icon: TrendingUp,
    title: "Decisões Rápidas",
    description: "Tomada de decisão acelerada com foco no que importa."
  }
];

const icp = [
  { label: "Faturamento", value: "R$ 150k–600k/mês", icon: BarChart3 },
];

const notIncluded = [
  "Direção mensal contínua (veja Control ou Sales Acceleration)",
  "Viagem e hospedagem (responsabilidade do cliente)",
  "Treinamento de time além do escopo da imersão",
  "Acompanhamento semanal de longo prazo"
];

// Import for Layers icon
import { Layers } from "lucide-react";

export default function GrowthRoomPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${growthRoomHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6 backdrop-blur-sm">
              <MapPin className="h-4 w-4" />
              Imersão Presencial
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Growth Room
            </h1>
            <p className="text-2xl md:text-3xl text-primary-foreground/90 font-medium mb-4">
              Redefinir rota de crescimento.
            </p>
            <p className="text-lg text-primary-foreground/70 mb-8 max-w-2xl">
              Sessão estratégica presencial intensiva de 3 dias. Redesenhe sua
              rota comercial e saia com um plano de execução de 90 dias fechado.
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
              O Papel da UNV no Growth Room
            </h2>
            <p className="text-body text-lg max-w-2xl mx-auto mb-8">
              No Growth Room, a UNV atua como facilitador intensivo, 
              concentrando meses de trabalho em 3 dias de imersão total.
            </p>
            <div className="p-6 bg-accent/5 rounded-xl border border-accent/20">
              <p className="text-foreground font-medium text-lg">
                "3 dias presenciais equivalem a 3 meses de reuniões online. É a forma mais rápida de redefinir sua rota."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Agenda */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Agenda da Imersão
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {agenda.map((item, i) => (
                <div key={i} className="card-premium p-6 group hover:border-accent/50 transition-colors relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-accent/20 group-hover:bg-accent transition-colors" />
                  <p className="text-accent font-bold text-xl mb-2">
                    {item.day}
                  </p>
                  <h3 className="font-semibold text-foreground text-lg mb-2">
                    {item.title}
                  </h3>
                  <p className="text-body text-sm mb-4">
                    {item.description}
                  </p>
                  <ul className="space-y-2">
                    {item.items.map((detail, j) => (
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
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Para Quem É
            </h2>
            <div className="card-premium p-8 text-center">
              <div className="w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-accent" />
              </div>
              <p className="text-small uppercase tracking-wider mb-2 text-muted-foreground">
                Faturamento
              </p>
              <p className="font-semibold text-foreground text-3xl mb-4">
                R$ 150k–600k/mês
              </p>
              <p className="text-body max-w-md mx-auto">
                Empresas que precisam de uma virada rápida. Ideal para quem quer 
                resultados intensivos em pouco tempo, com foco total.
              </p>
            </div>
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
              Uma experiência completa que vai do diagnóstico ao plano de execução, 
              com acompanhamento pós-imersão.
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

      {/* Format */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="card-highlight p-8 lg:p-12">
              <div className="flex flex-col lg:flex-row gap-8 items-center">
                <div className="w-20 h-20 rounded-2xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-10 w-10 text-accent" />
                </div>
                <div className="text-center lg:text-left">
                  <h3 className="heading-card text-foreground mb-3">
                    Formato Presencial Intensivo
                  </h3>
                  <p className="text-body text-lg mb-4">
                    3 dias de trabalho intensivo hands-on em local designado.
                    Longe das distrações do dia a dia, com foco total na sua operação.
                  </p>
                  <p className="text-small text-muted-foreground">
                    Viagem e hospedagem são responsabilidade do cliente.
                  </p>
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
              O Growth Room é intensivo e pontual. Para direção contínua, combine com outros produtos.
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
            R$ 12.000
          </p>
          <p className="text-primary-foreground/70 text-lg mb-4">
            Por empresa • Aplicação necessária
          </p>
          <p className="text-primary-foreground/50 text-sm mb-10 max-w-md mx-auto">
            Valor varia conforme tamanho da operação. Viagem e hospedagem não inclusos.
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
              Depois da imersão
            </p>
            <h2 className="heading-section text-foreground mb-6">
              Mantenha o Momentum com Control
            </h2>
            <p className="text-body text-lg mb-8 max-w-2xl mx-auto">
              Após a imersão, o UNV Control garante que você mantenha a execução 
              do plano de 90 dias com acompanhamento recorrente.
            </p>
            <Link to="/control">
              <Button variant="premium" size="lg">
                Conhecer UNV Control
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
