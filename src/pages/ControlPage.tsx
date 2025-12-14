import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, RefreshCw, Shield, MessageSquare, Users } from "lucide-react";

const deliverables = [
  "Direção recorrente com cadência definida",
  "Sessão de monitoria estratégica mensal",
  "Templates de gestão e cobrança",
  "Acesso a comunidade fechada",
  "UNV AI Advisor com cobrança semanal",
];

const gains = [
  "Consistência na execução comercial",
  "Momentum sustentado sem regressão",
  "Disciplina mantida a longo prazo",
];

const icp = [
  { label: "Faturamento", value: "R$ 100k–400k/mês" },
];

const notIncluded = [
  "Treinamento completo do time (veja Sales Acceleration)",
  "Imersões presenciais (veja Growth Room)",
  "Acesso a mentoria elite (veja Partners)",
];

export default function ControlPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-hero">
        <div className="container-premium">
          <div className="max-w-3xl">
            <div className="inline-block px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6">
              Direção Recorrente
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Control
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-4">
              Sustentar execução contínua.
            </p>
            <p className="text-lg text-primary-foreground/70 mb-8">
              Mantenha a consistência de execução com direção comercial
              recorrente. Check-ins mensais, templates e suporte com IA para
              manter seu time no trilho.
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
                    <RefreshCw className="h-5 w-5 text-accent" />
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
                    <Users className="h-5 w-5 text-accent" />
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
                  UNV AI Advisor — Nível Execução
                </h3>
                <p className="text-body">
                  Suporte IA com cobrança semanal, lembretes de checklist e
                  preparação de reuniões para manter a disciplina.
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
          <div className="flex flex-col md:flex-row justify-center gap-8 mb-6">
            <div>
              <p className="text-3xl md:text-4xl font-display font-bold text-accent">
                R$ 297–R$ 597
              </p>
              <p className="text-primary-foreground/70">por mês</p>
            </div>
          </div>
          <p className="text-primary-foreground/70 text-lg mb-10">
            Planos mensais disponíveis
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
