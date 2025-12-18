import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle,
  Shield,
  FileText,
  Scale,
  AlertTriangle,
  Users,
  Lock,
  XCircle,
  BarChart3,
  MessageSquare,
  Briefcase,
  ClipboardCheck
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";

const problems = [
  "Contratos feitos sem padrão",
  "Decisões tomadas sem respaldo jurídico",
  "Riscos trabalhistas e comerciais acumulados",
  "Jurídico só aparece quando o problema já existe"
];

const consequences = [
  "Passivos ocultos",
  "Travamento de decisões",
  "Medo de escalar",
  "Perda de tempo do empresário"
];

const deliverableCategories = [
  {
    title: "Jurídico Preventivo",
    icon: Shield,
    items: [
      "Análise de riscos da operação",
      "Mapeamento de vulnerabilidades jurídicas",
      "Checklist jurídico de crescimento",
      "Orientação preventiva contínua"
    ]
  },
  {
    title: "Contratos & Documentos",
    icon: FileText,
    items: [
      "Padronização de contratos (serviços, comerciais, vendedores, parceiros)",
      "Revisão jurídica de contratos existentes",
      "Ajustes conforme crescimento do negócio"
    ]
  },
  {
    title: "Consultoria Jurídica Contínua",
    icon: MessageSquare,
    items: [
      "Suporte para decisões estratégicas",
      "Orientação em negociações",
      "Apoio em conflitos comerciais",
      "Análise jurídica antes de decisões críticas"
    ]
  },
  {
    title: "Trabalhista & Relações de Trabalho",
    icon: Users,
    items: [
      "Orientação sobre CLT, PJ, terceirização",
      "Apoio na estruturação de cargos",
      "Redução de risco trabalhista",
      "Interface com UNV People"
    ]
  },
  {
    title: "LGPD & Compliance Básico",
    icon: Lock,
    items: [
      "Orientação inicial de LGPD",
      "Adequação básica de processos",
      "Termos de uso e políticas",
      "Redução de risco de sanções"
    ]
  }
];

const notIncluded = [
  "Atuação em processos judiciais complexos",
  "Contencioso pesado",
  "Demandas pontuais fora do escopo"
];

const indicators = [
  "Número de contratos revisados",
  "Riscos mitigados",
  "Decisões suportadas juridicamente",
  "Incidentes jurídicos evitados",
  "Tempo médio de resposta"
];

const idealFor = [
  "Empresas B2B",
  "Faturamento mensal: R$ 50 mil a R$ 2 milhões",
  "Times com funcionários CLT ou PJ, vendedores, prestadores",
  "Operações que vendem serviços ou fazem contratos recorrentes",
  "Empresas com crescimento acelerado"
];

const notFor = [
  "Pessoa física",
  "Microempresas informais",
  "Quem busca advogado pontual ou causa isolada"
];

const keyPhrases = [
  "Crescer com segurança jurídica.",
  "Jurídico preventivo para empresas em crescimento.",
  "Menos risco, mais decisão."
];

export default function SafePage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="container-premium relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-up">
            <div className="inline-block p-4 bg-card/95 rounded-xl shadow-lg mb-6 border border-border/50">
              <span className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">UNV Safe</span>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Scale className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Legal, Risk & Compliance Advisory</span>
            </div>
            <p className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-3xl mx-auto">
              Assessoria jurídica estratégica para terceirizar o jurídico da sua empresa de forma simples, previsível e orientada à proteção do crescimento.
            </p>
            <p className="text-lg text-primary font-medium mb-8">
              Não é escritório tradicional. Não é jurídico reativo.<br />
              É jurídico como sistema de segurança empresarial.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
                <Link to="/apply">
                  Proteger Meu Crescimento
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
        color="blue"
        productNumber={15}
        productName="UNV SAFE"
        tagline="Legal, Risk & Compliance Advisory"
        whatItDoes="Jurídico terceirizado, preventivo e consultivo, focado em reduzir riscos e dar segurança para decisões de crescimento."
        keyPoints={[
          "Jurídico preventivo",
          "Padronização de contratos",
          "Consultoria contínua",
          "Compliance básico"
        ]}
        arrow="Crescer com segurança jurídica."
        targetAudience={{
          revenue: "R$ 50k–2M/mês • Empresas B2B"
        }}
        schedule={[
          { period: "Contínuo", description: "Suporte jurídico recorrente" },
          { period: "Preventivo", description: "Análise de riscos" },
          { period: "On-demand", description: "Decisões estratégicas" }
        ]}
        scheduleType="recurring"
      />

      {/* O problema real */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              O Problema Real que o UNV Safe Resolve
            </h2>
            <div className="bg-card border border-border rounded-2xl p-8 md:p-12">
              <p className="text-lg text-muted-foreground mb-8 text-center">
                <span className="text-foreground font-semibold">Empresas crescem rápido, mas:</span>
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
                  <span className="text-foreground font-semibold">O resultado:</span>
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
              Como o UNV Safe Resolve
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Atuando como <span className="text-primary font-semibold">jurídico terceirizado, preventivo e consultivo</span>, focado em:
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                "Reduzir riscos antes que virem processos",
                "Dar segurança para decisões de crescimento",
                "Padronizar contratos e relações",
                "Proteger caixa e reputação"
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-muted-foreground text-left">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Entregáveis */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-12">
            Entregáveis do UNV Safe
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {deliverableCategories.map((category, index) => (
              <div key={index} className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <category.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{category.title}</h3>
                </div>
                <ul className="space-y-2">
                  {category.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* O que não está incluso */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-8">
              O Que Não Está Incluso
            </h2>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="space-y-3">
                {notIncluded.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 text-muted-foreground">
                    <XCircle className="h-5 w-5 text-muted-foreground/50 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground/70 mt-4 text-center">
                📌 Esses casos podem ser tratados à parte, se necessário.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Indicadores */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-12">
            Indicadores Acompanhados
          </h2>
          <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
            {indicators.map((indicator, index) => (
              <div key={index} className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg">
                <BarChart3 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">{indicator}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Perfil de Cliente Ideal
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Para quem é */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Para quem é
                </h3>
                <ul className="space-y-3">
                  {idealFor.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Para quem NÃO é */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  Para quem NÃO é
                </h3>
                <ul className="space-y-3">
                  {notFor.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-muted-foreground">
                      <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Formato */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">
              Formato do Produto
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Briefcase, text: "Assessoria jurídica recorrente" },
                { icon: Shield, text: "Atendimento consultivo e preventivo" },
                { icon: ClipboardCheck, text: "Suporte contínuo para decisões estratégicas" },
                { icon: Scale, text: "Sem cobrança por hora (modelo previsível)" }
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-muted-foreground text-left">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Investment */}
      <section className="section-padding bg-card border-y border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        <div className="container-premium text-center relative">
          <h2 className="heading-section text-foreground mb-8">Investimento</h2>
          <div className="bg-card border border-border rounded-2xl p-8 md:p-12 max-w-lg mx-auto">
            <p className="text-4xl font-bold text-foreground mb-2">R$ 3.000 a R$ 6.000</p>
            <p className="text-muted-foreground mb-2">/mês</p>
            <p className="text-sm text-muted-foreground/70 mb-8">
              (dependendo do porte e complexidade)
            </p>
            <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
              <Link to="/apply">
                Proteger Meu Crescimento
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Papel no ecossistema */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-8">
              Papel do UNV Safe no Ecossistema UNV
            </h2>
            <div className="bg-card border border-border rounded-xl p-6 space-y-3">
              {[
                "Protege crescimento gerado por Sales Acceleration",
                "Reduz risco financeiro (conecta com UNV Finance)",
                "Reduz risco trabalhista (conecta com UNV People)",
                "Dá segurança para decisões de liderança",
                "Aumenta LTV e retenção"
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Frases-chave */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <div className="space-y-4">
              {keyPhrases.map((phrase, index) => (
                <p key={index} className="text-xl md:text-2xl font-medium text-primary">
                  "{phrase}"
                </p>
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
              Pronto para Crescer com Segurança Jurídica?
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">
              UNV Safe terceiriza o jurídico das empresas para que o empresário cresça com segurança, clareza e previsibilidade, sem surpresas legais.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
                <Link to="/apply">
                  Proteger Meu Crescimento
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
