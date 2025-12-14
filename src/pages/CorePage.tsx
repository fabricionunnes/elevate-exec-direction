import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Target, Layers, Shield, MessageSquare } from "lucide-react";

const deliverables = [
  "Diagnóstico direcional detalhado",
  "Funil base com definição de etapas",
  "Scripts essenciais (abordagem, qualificação, fechamento)",
  "Metas básicas por vendedor",
  "Rotina mínima de cobrança",
  "AI Advisor básico",
];

const gains = [
  "Clareza e organização no processo comercial",
  "Redução de improviso nas conversas de vendas",
  "Base sólida pronta para escalar quando crescer",
];

const icp = [
  { label: "Faturamento", value: "R$ 50k–150k/mês" },
  { label: "Time", value: "1–5 vendedores" },
];

const notIncluded = [
  "Direção contínua (veja UNV Control)",
  "Treinamento de time além dos frameworks iniciais",
  "Monitoria de performance ou scorecards",
];

export default function CorePage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-hero">
        <div className="container-premium">
          <div className="max-w-3xl">
            <div className="inline-block px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6">
              Fundação
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Core
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-4">
              Organizar o caos comercial inicial.
            </p>
            <p className="text-lg text-primary-foreground/70 mb-8">
              Construa a base estrutural da sua operação comercial. Frameworks
              essenciais para parar de improvisar e começar a vender com método.
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
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Para Quem É
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
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
                    <Layers className="h-5 w-5 text-accent" />
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

      {/* AI Advisor */}
      <section className="py-12 bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <div className="card-highlight p-8 flex flex-col md:flex-row gap-6 items-center">
              <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-7 w-7 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  AI Advisor Básico Incluso
                </h3>
                <p className="text-body">
                  Suporte IA para organização inicial, lembretes e estruturação
                  do processo comercial.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's NOT Included */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              O Que NÃO Está Incluso
            </h2>
            <div className="space-y-4">
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
          <p className="text-4xl md:text-5xl font-display font-bold text-accent mb-4">
            R$ 997 – R$ 1.997
          </p>
          <p className="text-primary-foreground/70 text-lg mb-10">
            Investimento único
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
