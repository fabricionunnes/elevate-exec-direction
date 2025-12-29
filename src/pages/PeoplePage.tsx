import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle,
  Users,
  UserPlus,
  Target,
  Clock,
  BarChart3,
  Briefcase,
  Award,
  XCircle
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";
import logoPeople from "@/assets/logo-people.png";

const problems = [
  "Contratação errada",
  "Alto turnover",
  "Líderes despreparados",
  "Dono centralizando decisões",
  "Time desalinhado com metas"
];

const hiringDeliverables = [
  "Diagnóstico da vaga",
  "Perfil ideal técnico e comportamental",
  "Descrição estratégica da função",
  "Triagem e entrevistas",
  "Avaliação prática",
  "Ranking final de candidatos",
  "Recomendação objetiva de contratação"
];

const recurringDeliverables = [
  "Estrutura de cargos e responsabilidades",
  "Trilhas de carreira",
  "Processos seletivos contínuos",
  "Onboarding estruturado (30-60-90 dias)",
  "Avaliação de desempenho",
  "Apoio à formação de líderes",
  "Indicadores de pessoas (turnover, performance, tempo de contratação)"
];

export default function PeoplePage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="container-premium relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-up">
            <div className="inline-block p-6 bg-white/95 rounded-2xl shadow-lg mb-6 border border-border/50">
              <img 
                src={logoPeople} 
                alt="UNV People" 
                className="h-20 md:h-24 w-auto object-contain"
              />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-500">Gestão de Pessoas</span>
            </div>
            <p className="text-2xl text-blue-500 font-medium mb-4">
              Hiring, Performance & Leadership Structure
            </p>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Não é RH operacional. Não é departamento pessoal.
              É gestão estratégica de pessoas orientada a resultado.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white" asChild>
                <Link to="/diagnostico">
                  Estruturar Meu Time
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/compare">
                  Comparar Serviços
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trail Summary */}
      <ProductTrailSummary
        color="blue"
        productNumber={14}
        productName="UNV PEOPLE"
        tagline="Gestão Estratégica de Pessoas"
        whatItDoes="Transforma pessoas em sistema, não em tentativa e erro."
        keyPoints={[
          "Contratação estratégica",
          "Estrutura de cargos",
          "Avaliação de desempenho",
          "Formação de líderes"
        ]}
        arrow="Pessoas deixam de ser gargalo."
        targetAudience={{
          revenue: "Empresas em crescimento • Times comerciais"
        }}
        schedule={[
          { period: "Avulso", description: "Hiring por vaga" },
          { period: "Mensal", description: "Recorrente completo" },
          { period: "Contínuo", description: "Processos seletivos" }
        ]}
        scheduleType="recurring"
      />

      {/* O problema real */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              O Problema Real que Resolve
            </h2>
            <div className="bg-card border border-border rounded-2xl p-8 md:p-12">
              <p className="text-lg text-muted-foreground mb-8 text-center">
                <span className="text-foreground font-semibold">Empresas crescem mais rápido do que a maturidade das pessoas.</span>
              </p>
              <p className="text-center text-muted-foreground mb-6">Dores comuns:</p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {problems.map((problem, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{problem}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground text-center">
                  Cada erro em pessoas custa: <span className="text-foreground font-semibold">dinheiro, tempo do fundador, clima interno e crescimento sustentável</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como resolve */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              Como o UNV People Resolve
            </h2>
            <p className="text-xl text-muted-foreground">
              Transformando <span className="text-blue-500 font-semibold">pessoas em sistema</span>, não em tentativa e erro.
            </p>
          </div>
        </div>
      </section>

      {/* Modalidades */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-12">
            Modalidades do Produto
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Hiring */}
            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <UserPlus className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">UNV People — Hiring</h3>
                  <span className="text-sm text-muted-foreground">Avulso</span>
                </div>
              </div>
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-6">
                <p className="text-sm text-blue-500 font-medium">
                  "Preciso contratar rápido, mas não posso errar."
                </p>
              </div>
              <h4 className="font-semibold text-foreground mb-3">O que entrega:</h4>
              <ul className="space-y-2 mb-6">
                {hiringDeliverables.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg mb-6">
                <div className="flex items-start gap-3">
                  <Award className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-600 mb-1">Garantia de 90 dias</p>
                    <p className="text-xs text-muted-foreground">
                      Se o colaborador não permanecer na empresa, fazemos outra contratação sem custo adicional (1x).
                    </p>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">Investimento:</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Cargos operacionais</span>
                    <span className="font-bold text-foreground">R$ 4.000</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Cargos estratégicos e liderança</span>
                    <span className="font-bold text-foreground">R$ 8.000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recorrente */}
            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">UNV People — Recorrente</h3>
                  <span className="text-sm text-muted-foreground">Mensal</span>
                </div>
              </div>
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-6">
                <p className="text-sm text-blue-500 font-medium">
                  "Minha empresa cresce, mas pessoas viram gargalo."
                </p>
              </div>
              <h4 className="font-semibold text-foreground mb-3">O que entrega:</h4>
              <ul className="space-y-2 mb-6">
                {recurringDeliverables.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">Investimento mensal:</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Até 20 colaboradores</span>
                    <span className="font-bold text-foreground">R$ 2.500</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Até 35 colaboradores</span>
                    <span className="font-bold text-foreground">R$ 5.000</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Até 100 colaboradores</span>
                    <span className="font-bold text-foreground">R$ 6.000</span>
                  </div>
                </div>
              </div>
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
            <div className="bg-card border border-border rounded-2xl p-8">
              <ul className="space-y-4">
                {[
                  { icon: Briefcase, text: "Empresas em crescimento" },
                  { icon: Target, text: "Times comerciais" },
                  { icon: Clock, text: "Operações com turnover recorrente" }
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-blue-500" />
                    </div>
                    <span className="text-muted-foreground text-lg">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Papel estratégico */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Papel Estratégico no Ecossistema UNV
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: BarChart3, text: "Redução de churn indireto" },
                { icon: Target, text: "Base para Sales Acceleration" },
                { icon: Award, text: "Base para Leadership" },
                { icon: TrendingUp, text: "Proteção de margem no médio prazo" }
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
                  <item.icon className="h-5 w-5 text-blue-500 shrink-0" />
                  <span className="text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-4">
              Pronto para Estruturar Seu Time?
            </h2>
            <p className="text-muted-foreground mb-8">
              Pare de errar em contratações. Transforme pessoas em sistema.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white" asChild>
                <Link to="/diagnostico">
                  Estruturar Meu Time
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/compare">
                  Comparar Serviços
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

const TrendingUp = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);
