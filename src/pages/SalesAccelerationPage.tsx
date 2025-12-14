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
} from "lucide-react";
import salesTeam from "@/assets/sales-team.jpg";

const deliverables = [
  {
    phase: "Mês 1",
    title: "Quick Wins & Desbloqueio de Vendas",
    items: [
      "Script Master (abordagem, diagnóstico, proposta, fechamento)",
      "Sistema de Follow-up (cadência + templates)",
      "Checklist diário do vendedor (atividade e foco)",
      "Roteiro de reunião semanal do time",
      "Pipeline mínimo com critérios de passagem",
    ],
    gains: [
      "Aumento de conversas qualificadas",
      "Redução de perda por inércia",
      "Melhor fechamento por ajuste de discurso (meta operacional)",
    ],
    icon: Zap,
  },
  {
    phase: "Meses 2–3",
    title: "Conversão & Trilha de Payback",
    items: [
      "Estrutura de qualificação (critérios)",
      "Pipeline + forecast simples",
      "Playbook de propostas e objeções",
      "Plano de recuperação de leads perdidos",
      "Scorecard por vendedor (atividade + conversão)",
    ],
    gains: [
      "Conversão maior com mesmo volume de leads",
      "Ciclo de venda mais controlado",
      "Payback projetado até o 3º mês (projeção)",
    ],
    icon: TrendingUp,
  },
  {
    phase: "Meses 4–6",
    title: "Performance & Gestão",
    items: [
      "Cadência de gestão (agenda do líder)",
      "Modelo de feedback e cobrança",
      "PDI por vendedor (plano de evolução)",
      "Regras de performance",
    ],
    gains: [
      "Menos dependência do dono",
      "Time com responsabilidade por números",
    ],
    icon: Users,
  },
  {
    phase: "Meses 7–9",
    title: "Padronização & Escala",
    items: [
      "Estrutura de comissão simples e eficiente",
      "Manual do vendedor (padrão da empresa)",
      "Padronização do discurso por etapa do funil",
    ],
    gains: ["Time alinhado e replicável"],
    icon: FileText,
  },
  {
    phase: "Meses 10–12",
    title: "Controle de Crescimento & Decisões",
    items: [
      "Painel executivo de indicadores",
      "Mapa de prioridades e decisões",
      "Plano de crescimento validado + checklist de escala",
    ],
    gains: ["Crescimento com controle, sem caos"],
    icon: BarChart3,
  },
];

const icp = [
  { label: "Faturamento", value: "R$ 150k a R$ 1M/mês" },
  { label: "Time", value: "Mínimo 3 vendedores" },
  { label: "Decisor", value: "Dono diretamente envolvido" },
  { label: "Dor", value: "Baixa conversão, inconsistência, dependência do dono" },
];

const notIncluded = [
  "Não fazemos vendas por você",
  "Não garantimos números específicos de receita",
  "Não gerenciamos seu CRM diretamente",
  "Não fornecemos tráfego pago ou serviços de marketing",
];

export default function SalesAccelerationPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${salesTeam})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl">
            <div className="inline-block px-4 py-1.5 bg-accent/20 text-accent text-sm font-medium rounded-full mb-6">
              Programa Principal
            </div>
            <h1 className="heading-display text-primary-foreground mb-6">
              UNV Sales Acceleration
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/80 mb-8">
              Programa anual de direção comercial para treinar, acompanhar e
              acelerar seu time de vendas com método e previsibilidade.
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

      {/* ICP */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Para Quem É
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {icp.map((item, i) => (
                <div key={i} className="card-premium p-6 text-center">
                  <p className="text-small uppercase tracking-wider mb-2">
                    {item.label}
                  </p>
                  <p className="font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables by Phase */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Roadmap de 12 Meses
            </h2>
            <p className="text-body max-w-2xl mx-auto">
              Uma progressão estruturada de quick wins a sistemas de crescimento
              sustentável. Cada fase constrói sobre a anterior.
            </p>
          </div>

          <div className="space-y-8">
            {deliverables.map((phase, i) => (
              <div key={i} className="card-premium p-8 lg:p-10">
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="lg:w-1/3">
                    <div className="flex items-center gap-4 mb-4">
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
                  </div>
                  <div className="lg:w-1/3">
                    <h4 className="font-semibold text-foreground mb-3">
                      Entregáveis
                    </h4>
                    <ul className="space-y-2">
                      {phase.items.map((item, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2 text-small"
                        >
                          <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="lg:w-1/3">
                    <h4 className="font-semibold text-foreground mb-3">
                      Ganhos Esperados
                    </h4>
                    <ul className="space-y-2">
                      {phase.gains.map((gain, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2 text-small"
                        >
                          <TrendingUp className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                          <span>{gain}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Advisor */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="card-highlight p-8 lg:p-12">
              <div className="flex flex-col lg:flex-row gap-8 items-center">
                <div className="w-16 h-16 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-8 w-8 text-accent" />
                </div>
                <div>
                  <h3 className="heading-card text-foreground mb-3">
                    UNV AI Advisor
                  </h3>
                  <p className="text-body mb-4">
                    Camada de suporte inclusa para cobrança, checklists e
                    preparação de reuniões. Disponível durante todo o programa
                    para manter a execução no trilho.
                  </p>
                  <p className="text-small italic">
                    Nota: Esta é uma ferramenta de suporte, não um produto SaaS
                    standalone. Não fornece previsões de receita ou
                    decisões automatizadas.
                  </p>
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
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section mb-6">Investimento</h2>
            <p className="text-4xl md:text-5xl font-display font-bold text-accent mb-4">
              R$ 24.000 – R$ 36.000
            </p>
            <p className="text-primary-foreground/70 text-lg mb-6">
              Programa anual • À vista ou parcelado
            </p>
            <p className="text-sm text-primary-foreground/50 mb-10 max-w-xl mx-auto">
              Resultados variam conforme execução. Payback é projeção
              operacional, não garantia. UNV direciona e cobra—o cliente executa.
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
