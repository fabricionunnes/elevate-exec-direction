import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle,
  DollarSign,
  TrendingUp,
  PieChart,
  BarChart3,
  Calculator,
  FileText,
  Target,
  AlertTriangle
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";
import logoFinance from "@/assets/logo-finance.png";

const problems = [
  "Não sabem onde ganham dinheiro",
  "Não sabem onde perdem",
  "Não têm previsibilidade de caixa",
  "Tomam decisões no escuro"
];

const consequences = [
  "Stress constante",
  "Crescimento desorganizado",
  "Decisões erradas de investimento",
  "Travamento de escala"
];

const deliverables = [
  { icon: FileText, text: "Organização financeira da empresa" },
  { icon: BarChart3, text: "DRE gerencial mensal" },
  { icon: TrendingUp, text: "Controle de fluxo de caixa" },
  { icon: PieChart, text: "Análise de margem por produto" },
  { icon: Calculator, text: "Apoio à precificação" },
  { icon: Target, text: "Apoio à tomada de decisão" },
  { icon: DollarSign, text: "Projeção de caixa (90 dias)" }
];

const indicators = [
  "Receita líquida",
  "Margem por produto",
  "Custos fixos e variáveis",
  "Ponto de equilíbrio",
  "Caixa disponível (meses)",
  "Inadimplência"
];

export default function FinancePage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="container-premium relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-up">
            <div className="inline-block p-6 bg-white/95 rounded-2xl shadow-lg mb-6 border border-border/50">
              <img 
                src={logoFinance} 
                alt="UNV Finance" 
                className="h-20 md:h-24 w-auto object-contain"
              />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
              <DollarSign className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">Controle Financeiro</span>
            </div>
            <p className="text-2xl text-accent font-medium mb-4">
              Financial Control, Cash & Decision Support
            </p>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Não é contabilidade. Não é BPO financeiro básico.
              É controle, visão e decisão financeira para empresários.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
                <Link to="/diagnostico">
                  Organizar Minhas Finanças
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/compare">
                  Comparar Produtos
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trail Summary */}
      <ProductTrailSummary
        color="green"
        productNumber={13}
        productName="UNV FINANCE"
        tagline="Controle Financeiro Estratégico"
        whatItDoes="Clareza financeira simples, visual e acionável, sem burocracia."
        keyPoints={[
          "DRE gerencial mensal",
          "Fluxo de caixa",
          "Margem por produto",
          "Projeção de caixa"
        ]}
        arrow="Decisões no claro, não no escuro."
        targetAudience={{
          revenue: "Empresários e empresas em crescimento"
        }}
        schedule={[
          { period: "Mensal", description: "DRE gerencial" },
          { period: "Semanal", description: "Fluxo de caixa" },
          { period: "90 dias", description: "Projeção de caixa" }
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
                <span className="text-foreground font-semibold">Empresas faturam, mas:</span>
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                {problems.map((problem, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{problem}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground text-center mb-3">
                  <span className="text-foreground font-semibold">Isso gera:</span>
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {consequences.map((item, index) => (
                    <span key={index} className="px-3 py-1 bg-destructive/10 text-destructive text-sm rounded-full">
                      {item}
                    </span>
                  ))}
                </div>
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
              Como o UNV Finance Resolve
            </h2>
            <p className="text-xl text-muted-foreground">
              Trazendo <span className="text-accent font-semibold">clareza financeira simples, visual e acionável</span>, sem burocracia.
            </p>
          </div>
        </div>
      </section>

      {/* Entregáveis */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-12">
            Estrutura da Entrega
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {deliverables.map((item, index) => (
              <div key={index} className="flex items-start gap-4 p-6 bg-card border border-border rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                  <item.icon className="h-5 w-5 text-accent" />
                </div>
                <span className="text-foreground font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Indicadores */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-12">
            Indicadores Acompanhados
          </h2>
          <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
            {indicators.map((indicator, index) => (
              <div key={index} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg">
                <CheckCircle className="h-4 w-4 text-accent shrink-0" />
                <span className="text-muted-foreground">{indicator}</span>
              </div>
            ))}
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
            <div className="bg-card border border-border rounded-2xl p-8">
              <ul className="space-y-4">
                {["Empresários", "Empresas em crescimento", "Operações com múltiplos produtos"].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-muted-foreground text-lg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">
              Investimento
            </h2>
            <div className="bg-card border border-border rounded-2xl p-8 md:p-12">
              <p className="text-4xl font-bold text-foreground mb-2">R$ 3.000</p>
              <p className="text-muted-foreground mb-6">/mês</p>
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
                <Link to="/diagnostico">
                  Organizar Minhas Finanças
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-4">
              Pronto para Ter Clareza Financeira?
            </h2>
            <p className="text-muted-foreground mb-8">
              Pare de tomar decisões no escuro. Tenha visão clara do seu negócio.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
                <Link to="/diagnostico">
                  Organizar Minhas Finanças
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/compare">
                  Comparar Produtos
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
