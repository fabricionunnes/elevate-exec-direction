import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Users2, Shield, MessageSquare, BarChart } from "lucide-react";

const deliverables = [
  "Trilhas de treinamento por cargo (SDR, Closer, Gestor)",
  "Discurso padronizado por cargo e etapa do funil",
  "Avaliações individuais e scorecards",
  "Suporte IA customizado por cargo",
];

const gains = [
  "Operações de time padronizadas",
  "Menor dependência do dono",
  "Onboarding escalável para novas contratações",
];

const icp = [
  { label: "Faturamento", value: "R$ 200k+/mês" },
  { label: "Time", value: "5+ vendedores" },
];

const notIncluded = [
  "Direção estratégica (veja Sales Acceleration ou Partners)",
  "Sessões de treinamento presencial",
  "Implementação ou gestão de CRM",
];

export default function SalesOpsPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-hero">
        <div className="container-premium">
          <div className="max-w-3xl">
            <div className="inline-block px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6">
              Padronização de Times
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Sales Ops
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-8">
              Padronize seu time comercial em escala. Trilhas de treinamento por
              cargo, scorecards e suporte IA para execução consistente em todo
              o time.
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
                    <Users2 className="h-5 w-5 text-accent" />
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
                    <BarChart className="h-5 w-5 text-accent" />
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

      {/* Role-based */}
      <section className="py-12 bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              {["Trilha SDR", "Trilha Closer", "Trilha Gestor"].map((track, i) => (
                <div key={i} className="card-premium p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <Users2 className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground">{track}</h3>
                  <p className="text-small mt-2">
                    Treinamento customizado, scripts e scorecards
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Support */}
      <section className="py-12 bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <div className="card-highlight p-8 flex flex-col md:flex-row gap-6 items-center">
              <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-7 w-7 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  Suporte IA Por Cargo
                </h3>
                <p className="text-body">
                  Cada cargo recebe assistência IA customizada para execução
                  diária, tratamento de objeções e acompanhamento de atividades.
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
            R$ 97 – R$ 297
          </p>
          <p className="text-primary-foreground/70 text-lg mb-10">
            Por usuário, por mês
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
