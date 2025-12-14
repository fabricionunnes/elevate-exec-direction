import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, MapPin, Shield, Calendar, Target, MessageSquare } from "lucide-react";
import strategySession from "@/assets/strategy-session.jpg";

const deliverables = [
  "Diagnóstico prévio detalhado",
  "3 dias de sessões presenciais intensivas",
  "Funil completo estruturado",
  "Metas e KPIs definidos",
  "Plano de execução de 90 dias fechado",
  "Pós-imersão: checkpoints de acompanhamento",
  "AI Advisor configurado",
];

const gains = [
  "Direção clara e foco imediato",
  "Plano executável que você leva pronto",
  "Alinhamento entre dono e time",
  "Tomada de decisão rápida",
];

const icp = [
  { label: "Faturamento", value: "R$ 150k–600k/mês" },
];

const notIncluded = [
  "Direção mensal contínua (veja Control ou Sales Acceleration)",
  "Viagem e hospedagem (responsabilidade do cliente)",
  "Treinamento de time além do escopo da imersão",
];

export default function GrowthRoomPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${strategySession})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl">
            <div className="inline-block px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6">
              Imersão Presencial
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Growth Room
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-4">
              Redefinir rota de crescimento.
            </p>
            <p className="text-lg text-primary-foreground/70 mb-8">
              Sessão estratégica presencial intensiva de 3 dias. Redesenhe sua
              rota comercial e saia com um plano de execução de 90 dias fechado.
            </p>
            <Link to="/apply">
              <Button variant="hero" size="xl">
                Aplicar Agora
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Para Quem É
            </h2>
            {icp.map((item, i) => (
              <div key={i} className="card-premium p-6 text-center">
                <p className="text-small uppercase tracking-wider mb-2">
                  {item.label}
                </p>
                <p className="font-semibold text-foreground text-lg">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-accent" />
                  </div>
                  <h2 className="heading-card text-foreground">Entregáveis</h2>
                </div>
                <ul className="space-y-4">
                  {deliverables.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                      <span className="text-body">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-accent" />
                  </div>
                  <h2 className="heading-card text-foreground">
                    Ganhos Esperados
                  </h2>
                </div>
                <ul className="space-y-4">
                  {gains.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                      <span className="text-body">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Format */}
      <section className="py-12 bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <div className="card-highlight p-8 flex flex-col md:flex-row gap-6 items-center">
              <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-7 w-7 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  Formato Presencial
                </h3>
                <p className="text-body">
                  3 dias de trabalho intensivo hands-on em local designado.
                  Viagem e hospedagem são responsabilidade do cliente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Advisor */}
      <section className="py-12 bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <div className="card-premium p-8 flex flex-col md:flex-row gap-6 items-center">
              <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-7 w-7 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  AI Advisor Configurado
                </h3>
                <p className="text-body">
                  Após a imersão, você recebe o AI Advisor configurado para
                  acompanhar a execução do plano de 90 dias.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's NOT Included */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              O Que NÃO Está Incluso
            </h2>
            <div className="space-y-4">
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
          <p className="text-4xl md:text-5xl font-display font-bold text-accent mb-4">
            R$ 12.000 – R$ 20.000
          </p>
          <p className="text-primary-foreground/70 text-lg mb-10">
            Por empresa • Aplicação necessária
          </p>
          <Link to="/apply">
            <Button variant="hero" size="xl">
              Aplicar Agora
              <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
