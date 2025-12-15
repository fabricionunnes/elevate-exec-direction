import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Users,
  Zap,
  FileText,
  BarChart3,
  MessageSquare,
  Shield,
  Target,
  Calendar,
  Home,
} from "lucide-react";
import salesTeam from "@/assets/sales-team.jpg";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";
import logoSalesAcceleration from "@/assets/logo-sales-acceleration.png";

const unvRole = [
  "Método comercial",
  "Treinamento do time",
  "Organização do processo",
  "Cadência de execução",
  "Cobrança de performance",
  "Correção de rota",
];

const deliverables = [
  {
    phase: "Fase 1 — Mês 1",
    title: "Sales Unblocking",
    objective: "Gerar impacto imediato em vendas.",
    whatWesDo: [
      "Audita discurso de vendas",
      "Identifica gargalos de fechamento",
      "Corrige erros de abordagem",
      "Simplifica processo",
      "Define padrão mínimo obrigatório",
    ],
    training: [
      "Como abordar leads corretamente",
      "Como diagnosticar dor real",
      "Como conduzir conversa sem pressão",
      "Como fechar com segurança",
    ],
    items: [
      "Script master (abordagem → fechamento)",
      "Roteiro de reunião de vendas",
      "Sequência de follow-up estruturada",
      "Checklist diário do vendedor",
      "Pipeline mínimo com critérios claros",
    ],
    gains: [
      "Vendedores mais seguros",
      "Conversas mais qualificadas",
      "Aumento inicial de conversão",
    ],
    icon: Zap,
  },
  {
    phase: "Fase 2 — Meses 2–3",
    title: "Conversion & Payback",
    objective: "Aumentar conversão e gerar retorno financeiro.",
    whatWesDo: [
      "Estrutura qualificação real",
      "Organiza pipeline",
      "Implanta gestão de propostas",
      "Ataca perda por inércia",
      "Cria rotina de cobrança diária",
    ],
    training: [
      "Qualificação avançada",
      "Argumentação de valor",
      "Gestão de objeções",
      "Follow-up de fechamento",
    ],
    items: [
      "Matriz de qualificação",
      "Pipeline com forecast simples",
      "Playbook de propostas",
      "Plano de recuperação de leads",
      "Scorecard individual por vendedor",
    ],
    gains: [
      "Mais vendas com mesmos leads",
      "Ciclo de vendas mais curto",
      "Payback projetado até o 3º mês (projeção)",
    ],
    icon: TrendingUp,
  },
  {
    phase: "Fase 3 — Meses 4–6",
    title: "Performance & Gestão",
    objective: "Tirar o dono do operacional.",
    whatWesDo: [
      "Estrutura rotina de gestão",
      "Treina gestor em cobrança",
      "Implanta feedback por números",
      "Desenvolve autonomia do time",
    ],
    training: [
      "Gestão por indicadores",
      "Feedback estruturado",
      "Responsabilização do time",
    ],
    items: [
      "Agenda oficial de gestão comercial",
      "Modelo de reunião semanal",
      "Modelo de feedback individual",
      "PDI por vendedor",
      "Regras claras de performance",
    ],
    gains: [
      "Dono menos sobrecarregado",
      "Time mais responsável",
    ],
    icon: Users,
  },
  {
    phase: "Fase 4 — Meses 7–9",
    title: "Padronização & Escala",
    objective: "Preparar crescimento sem perder controle.",
    whatWesDo: [
      "Padroniza discurso",
      "Estrutura comissão",
      "Define regras de crescimento",
    ],
    training: [],
    items: [
      "Estrutura de comissionamento",
      "Manual do vendedor da empresa",
      "Padrão de discurso por etapa",
      "Checklist de contratação futura",
    ],
    gains: [
      "Time replicável",
      "Crescimento sustentável",
    ],
    icon: FileText,
  },
  {
    phase: "Fase 5 — Meses 10–12",
    title: "Direção Madura",
    objective: "Decisões estratégicas com segurança.",
    whatWesDo: [
      "Organiza indicadores",
      "Apoia decisões de crescimento",
      "Prepara próximos ciclos",
    ],
    training: [],
    items: [
      "Painel executivo de indicadores",
      "Mapa de prioridades",
      "Plano de crescimento validado",
    ],
    gains: [
      "Clareza total de direção",
      "Menos risco nas decisões",
    ],
    icon: BarChart3,
  },
];

const icp = [
  { label: "Faturamento", value: "R$ 150k a R$ 1M/mês" },
  { label: "Time", value: "3 a 20 vendedores" },
  { label: "Ticket Médio", value: "A partir de R$ 1.500" },
  { label: "Lead Flow", value: "Existente (orgânico, pago ou outbound)" },
];

const icpPains = [
  "Baixa conversão",
  "Time inconsistente",
  "Dependência excessiva do dono",
];

const whoDoesNotFit = [
  "Empresas sem time comercial",
  "Negócios pré-validação",
  "Donos ausentes",
];

const aiAdvisorFeatures = [
  "Checklists por fase",
  "Cobrança semanal",
  "Preparação de reuniões",
  "Organização de decisões",
];

const mansionBenefits = [
  "1 convite anual",
  "Curadoria pessoal",
  "Decisões reais",
  "Networking de elite",
  "Custos por conta do cliente",
];

const governance = [
  { label: "Contrato", value: "12 meses" },
  { label: "Onboarding", value: "Estruturado (30 dias)" },
  { label: "Semanal", value: "Execução e cobrança" },
  { label: "Mensal", value: "Direção e priorização" },
  { label: "Trimestral", value: "Revisão estratégica" },
];

const notIncluded = [
  "Não executamos vendas por você",
  "Não garantimos números específicos de faturamento",
  "Não gerenciamos seu CRM diretamente",
  "Não fornecemos tráfego pago ou serviços de marketing",
];

export default function SalesAccelerationPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center hero-dark">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${salesTeam})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl">
            <img src={logoSalesAcceleration} alt="UNV Sales Acceleration" className="h-20 md:h-24 mb-6" />
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary text-sm font-medium rounded-full mb-6 border border-primary/30">
              Programa Principal
            </div>
            <p className="text-xl md:text-2xl hero-subtitle mb-4">
              Direção Comercial Anual focada em Aceleração de Vendas
            </p>
            <p className="text-lg hero-description mb-8">
              Programa de 12 meses para treinar, acompanhar e acelerar seu time
              de vendas com método e previsibilidade.
            </p>
            <Link to="/apply">
              <Button variant="hero" size="xl">
                Aplicar para Diagnóstico
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Trail Summary */}
      <ProductTrailSummary
        color="red"
        productNumber={3}
        productName="UNV SALES ACCELERATION"
        tagline="Produto Principal"
        whatItDoes="Atua como a direção comercial ativa da empresa para acelerar vendas do time."
        keyPoints={[
          "Treina vendedores",
          "Treina gestor",
          "Corrige discurso",
          "Organiza pipeline",
          "Cobra execução",
          "Padroniza operação",
          "Acelera conversão"
        ]}
        arrow="Resultado já no 1º mês (quick wins). Payback projetado até o 3º mês."
        targetAudience={{
          revenue: "R$ 150k a R$ 1M/mês",
          team: "Com time ativo e dor de conversão"
        }}
        schedule={[
          { period: "Mês 1 (Unblocking)", description: "Destravar vendas" },
          { period: "Meses 2–3 (Conversão)", description: "Aumentar fechamento" },
          { period: "Meses 4–6 (Gestão)", description: "Tirar dono do gargalo" },
          { period: "Meses 7–9 (Padronização)", description: "Preparar escala" },
          { period: "Meses 10–12 (Direção madura)", description: "Crescer com controle" }
        ]}
        scheduleType="phases"
      />

      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Papel da UNV Neste Produto
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              Neste produto, a UNV atua como o diretor comercial funcional da
              empresa, assumindo responsabilidade sobre:
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {unvRole.map((item, i) => (
                <div key={i} className="card-premium p-5 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                  <span className="font-medium text-foreground">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 p-4 bg-accent/10 rounded-lg border border-accent/20">
              <p className="text-center text-foreground font-medium">
                ⚠️ A UNV não executa vendas, mas comanda como elas devem acontecer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              ICP — Perfil Ideal de Cliente
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {icp.map((item, i) => (
                <div key={i} className="card-premium p-6 text-center">
                  <p className="text-small uppercase tracking-wider mb-2">
                    {item.label}
                  </p>
                  <p className="font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground mb-4">
                  Dor do Dono
                </h3>
                <ul className="space-y-2">
                  {icpPains.map((pain, i) => (
                    <li key={i} className="flex items-center gap-2 text-body">
                      <Target className="h-4 w-4 text-accent flex-shrink-0" />
                      {pain}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground mb-4">
                  Quem NÃO Entra
                </h3>
                <ul className="space-y-2">
                  {whoDoesNotFit.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="h-4 w-4 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Governança */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Duração, Ritmo e Governança
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {governance.map((item, i) => (
                <div key={i} className="card-premium p-5 text-center">
                  <p className="text-small uppercase tracking-wider mb-2">
                    {item.label}
                  </p>
                  <p className="font-medium text-foreground text-sm">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables by Phase */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Estrutura do Programa — 5 Fases
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Uma progressão estruturada de desbloqueio imediato a direção madura.
              Cada fase constrói sobre a anterior.
            </p>
          </div>

          <div className="space-y-8">
            {deliverables.map((phase, i) => (
              <div key={i} className="card-premium p-8 lg:p-10">
                <div className="flex flex-col gap-6">
                  {/* Header */}
                  <div className="flex items-center gap-4 pb-4 border-b border-border">
                    <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                      <phase.icon className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <p className="text-accent font-medium">{phase.phase}</p>
                      <h3 className="heading-card text-foreground">
                        {phase.title}
                      </h3>
                    </div>
                  </div>
                  
                  {/* Objective */}
                  <p className="text-body font-medium">
                    <span className="text-accent">Objetivo:</span> {phase.objective}
                  </p>

                  <div className="grid lg:grid-cols-2 xl:grid-cols-4 gap-6">
                    {/* O que a UNV faz */}
                    <div>
                      <h4 className="font-semibold text-foreground mb-3">
                        O Que a UNV Faz
                      </h4>
                      <ul className="space-y-2">
                        {phase.whatWesDo.map((item, j) => (
                          <li key={j} className="flex items-start gap-2 text-small">
                            <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Training (if exists) */}
                    {phase.training.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-foreground mb-3">
                          Treinamento Aplicado
                        </h4>
                        <ul className="space-y-2">
                          {phase.training.map((item, j) => (
                            <li key={j} className="flex items-start gap-2 text-small">
                              <Users className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Entregáveis */}
                    <div>
                      <h4 className="font-semibold text-foreground mb-3">
                        Entregáveis Concretos
                      </h4>
                      <ul className="space-y-2">
                        {phase.items.map((item, j) => (
                          <li key={j} className="flex items-start gap-2 text-small">
                            <FileText className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Ganhos */}
                    <div>
                      <h4 className="font-semibold text-foreground mb-3">
                        Ganho Percebido
                      </h4>
                      <ul className="space-y-2">
                        {phase.gains.map((gain, j) => (
                          <li key={j} className="flex items-start gap-2 text-small">
                            <TrendingUp className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                            <span>{gain}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Advisor */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="card-highlight p-8 lg:p-12">
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-16 h-16 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-8 w-8 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="heading-card text-foreground mb-3">
                    UNV AI Advisor — Nível Máximo
                  </h3>
                  <p className="text-body mb-6">
                    Camada de suporte inclusa durante todo o programa para garantir execução.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {aiAdvisorFeatures.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-accent" />
                        <span className="text-small">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-small italic mt-6 text-muted-foreground">
                    ⚠️ Não substitui humanos, garante execução.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mansion Experience */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="card-premium p-8 lg:p-12">
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Home className="h-8 w-8 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="heading-card text-foreground mb-3">
                    Experiência Premium — Mansão Empresarial
                  </h3>
                  <p className="text-body mb-6">
                    Acesso exclusivo a encontros estratégicos presenciais com empresários do mesmo nível.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {mansionBenefits.map((benefit, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-accent" />
                        <span className="text-small">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
      <section className="section-padding bg-card border-y border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
        <div className="container-premium relative">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">Investimento</h2>
            <p className="text-4xl md:text-5xl font-display font-bold text-primary mb-4">
              R$ 24.000
            </p>
            <p className="text-muted-foreground text-lg mb-2">
              Programa anual • À vista ou parcelado
            </p>
            <p className="text-muted-foreground mb-6">
              Aplicação obrigatória
            </p>
            <p className="text-sm text-muted-foreground/60 mb-10 max-w-xl mx-auto">
              Resultados variam conforme execução. Payback é projeção operacional,
              não garantia. UNV direciona e cobra — o cliente executa.
            </p>
            <Link to="/apply">
              <Button variant="hero" size="xl">
                Aplicar para Diagnóstico
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
