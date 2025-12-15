import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  RefreshCw, 
  Shield, 
  MessageSquare, 
  Users,
  Calendar,
  FileText,
  BarChart3,
  Clock,
  Sparkles,
  TrendingUp,
  Target,
  XCircle,
  Eye,
  Compass,
  UserCheck
} from "lucide-react";
import controlHero from "@/assets/control-hero.jpg";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";
import logoControl from "@/assets/logo-control.png";

const unvRole = [
  { title: "Diretor comercial recorrente", description: "Mantém a direção comercial ativa mês a mês" },
  { title: "Guardião do processo", description: "Garante que o processo não morra" },
  { title: "Ponto de correção de rota", description: "Identifica e corrige desvios rapidamente" },
  { title: "Estrutura de cobrança", description: "Mantém a disciplina de execução" },
  { title: "Apoio estratégico", description: "Suporte ao dono/gestor nas decisões" },
];

const pillars = [
  {
    number: "01",
    icon: Compass,
    title: "Direção Comercial Recorrente",
    description: "A UNV atua todo mês como a direção comercial externa da empresa.",
    whatWeDo: [
      "Define prioridades comerciais do mês",
      "Ajusta foco do time",
      "Corrige desvios de rota",
      "Apoia decisões do dono"
    ],
    frequency: "1 encontro estratégico mensal (direção + prioridades)",
    deliverables: "Agenda de prioridades do mês + Direcionamento de foco + Decisões documentadas",
    gain: "Todo mês eu sei exatamente onde focar."
  },
  {
    number: "02",
    icon: Eye,
    title: "Monitoria de Execução",
    description: "Acompanhamento da execução sem microgerenciamento.",
    whatWeDo: [
      "Analisa se o combinado está sendo executado",
      "Identifica gargalos recorrentes",
      "Propõe correções práticas",
      "Cobra ajustes quando necessário"
    ],
    frequency: "Monitoria mensal em grupo ou individual (conforme plano)",
    deliverables: "Correções táticas + Ajustes de processo + Reforço de disciplina",
    gain: "O plano não fica só no papel."
  },
  {
    number: "03",
    icon: FileText,
    title: "Templates de Gestão e Cobrança",
    description: "Entrega contínua de ferramentas práticas de gestão comercial.",
    whatWeDo: [
      "Agenda semanal do comercial",
      "Roteiro de reunião semanal",
      "Checklist de cobrança do gestor",
      "Estrutura simples de comissionamento",
      "Modelo de acompanhamento de metas"
    ],
    frequency: "Acesso contínuo",
    deliverables: "Templates prontos para uso imediato",
    gain: "Eu sei exatamente como cobrar sem desgastar o time."
  },
  {
    number: "04",
    icon: Users,
    title: "Comunidade Fechada de Empresários",
    description: "Ambiente fechado de empresários que vivem a mesma realidade.",
    whatWeDo: [
      "Benchmark real entre empresas",
      "Troca prática de experiências",
      "Evitar decisões ruins por isolamento"
    ],
    frequency: "Acesso contínuo",
    deliverables: "Sem autopromoção • Sem curiosos • Sem conteúdo motivacional vazio",
    gain: "Eu não tomo decisões no escuro."
  },
  {
    number: "05",
    icon: Sparkles,
    title: "UNV AI Advisor (Nível Control)",
    description: "Camada de cobrança e suporte contínuo.",
    whatWeDo: [
      "Cobra execução semanal",
      "Lembra metas e prioridades",
      "Ajuda o gestor a cobrar o time",
      "Organiza decisões e tarefas"
    ],
    frequency: "Suporte contínuo via IA",
    deliverables: "Cobrança automatizada + Lembretes + Organização",
    gain: "A execução não depende da minha memória ou motivação."
  }
];

const cadence = [
  { 
    period: "Semanal", 
    icon: Clock,
    items: [
      "Cobrança de execução (gestor → time)",
      "Acompanhamento de atividades-chave"
    ]
  },
  { 
    period: "Mensal", 
    icon: Calendar,
    items: [
      "Encontro estratégico com UNV",
      "Ajuste de foco e prioridades",
      "Correção de rota"
    ]
  },
  { 
    period: "Trimestral", 
    icon: BarChart3,
    items: [
      "Revisão geral de performance",
      "Avaliação de evolução",
      "Decisão de próximos passos"
    ]
  },
];

const immediateGains = [
  { icon: Target, title: "Mais disciplina", description: "Execução constante e previsível" },
  { icon: RefreshCw, title: "Menos regressão", description: "Time não volta aos velhos hábitos" },
  { icon: Compass, title: "Foco mensal claro", description: "Prioridades definidas todo mês" },
];

const structuralGains = [
  { icon: TrendingUp, title: "Processo vivo", description: "Comercial funcionando continuamente" },
  { icon: Users, title: "Time mais consistente", description: "Execução regular e previsível" },
  { icon: UserCheck, title: "Dono fora do gargalo", description: "Operação funciona sem você" },
  { icon: BarChart3, title: "Comercial previsível", description: "Resultados mais estáveis" },
];

const icp = [
  { label: "Faturamento", value: "R$ 100k–400k/mês", icon: BarChart3 },
];

const icpHas = [
  "Funil desenhado",
  "Scripts definidos",
  "Metas estabelecidas"
];

const icpProblems = [
  "Falta de constância",
  "Execução irregular",
  "Regressão ao improviso",
  "Cobrança fraca do gestor/dono"
];

const whoIsNot = [
  "Empresas sem base mínima",
  "Donos que não querem ser cobrados",
  "Negócios sem time comercial ativo"
];

const notIncluded = [
  "Não faz aceleração agressiva de vendas",
  "Não reestrutura tudo do zero",
  "Não substitui liderança interna",
  "Não garante faturamento"
];

const aiAdvisorLimits = [
  "Não executa vendas",
  "Não analisa CRM",
  "Não substitui pessoas"
];

const nextProducts = [
  { name: "Sales Acceleration", description: "Aceleração real", href: "/sales-acceleration" },
  { name: "Growth Room", description: "Estratégia presencial", href: "/growth-room" },
  { name: "UNV Partners", description: "Board estratégico", href: "/partners" },
];

export default function ControlPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center hero-dark">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${controlHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-block p-3 bg-white/95 rounded-xl shadow-lg mb-6">
              <img src={logoControl} alt="UNV Control" className="h-16 md:h-20" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary text-sm font-medium rounded-full mb-6 backdrop-blur-sm border border-primary/30">
              Ongoing Commercial Direction & Execution Discipline
            </div>
            <p className="text-2xl md:text-3xl hero-subtitle font-medium mb-4">
              O que impede sua empresa de voltar para o improviso.
            </p>
            <p className="text-lg hero-description mb-8 max-w-2xl">
              Direção comercial recorrente que mantém o processo comercial vivo, 
              garantindo disciplina, constância e foco mês após mês.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/apply">
                <Button variant="hero" size="xl">
                  Aplicar Agora
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link to="/products">
                <Button variant="outline" size="xl" className="border-white/30 text-white hover:bg-white/10">
                  Ver Todos os Produtos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trail Summary */}
      <ProductTrailSummary
        color="blue"
        productNumber={2}
        productName="UNV CONTROL"
        tagline="Execution Discipline"
        whatItDoes="Evita que o processo morra depois de organizado."
        keyPoints={[
          "Direção comercial mensal",
          "Monitoria de execução",
          "Correção de rota",
          "Cobrança indireta",
          "Disciplina contínua"
        ]}
        arrow="Sustenta execução e impede regressão."
        targetAudience={{
          revenue: "R$ 100k a R$ 400k/mês"
        }}
        schedule={[
          { period: "Semanal", description: "Cobrança e acompanhamento" },
          { period: "Mensal", description: "Direção estratégica" },
          { period: "Trimestral", description: "Revisão e ajustes" }
        ]}
        scheduleType="recurring"
      />

      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              O Que É o UNV Control
            </h2>
            <p className="text-body text-lg max-w-3xl mx-auto mb-8">
              O UNV Control é o produto onde a UNV atua como <span className="text-primary font-semibold">direção comercial recorrente</span>, 
              garantindo que o processo comercial não morra depois de organizado.
            </p>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="card-premium p-6 text-left">
                <CheckCircle className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold text-foreground text-lg mb-2">O que ele é</h3>
                <p className="text-muted-foreground">
                  Continuidade, disciplina e constância. Mantém o comercial no trilho, mês após mês.
                </p>
              </div>
              <div className="card-premium p-6 text-left">
                <XCircle className="h-8 w-8 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-foreground text-lg mb-2">O que ele NÃO é</h3>
                <p className="text-muted-foreground">
                  Não é um projeto pontual. É direção recorrente com compromisso de execução.
                </p>
              </div>
            </div>
            <div className="p-6 bg-primary/5 rounded-xl border border-primary/20">
              <p className="text-foreground font-medium text-lg">
                📌 O Control existe para manter o comercial no trilho, mês após mês.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Papel da UNV */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              O Papel da UNV no Control
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              Neste produto, a UNV atua como:
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {unvRole.map((role, i) => (
                <div key={i} className="card-premium p-6 group hover:border-primary/50 transition-colors">
                  <CheckCircle className="h-6 w-6 text-primary mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">{role.title}</h3>
                  <p className="text-small text-muted-foreground">{role.description}</p>
                </div>
              ))}
            </div>
            <div className="p-6 bg-primary/5 rounded-xl border border-primary/20">
              <p className="text-center text-foreground font-medium">
                ⚠️ A UNV não executa vendas, não substitui gestor interno e não assume CRM.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              ICP — Perfil Ideal de Cliente
            </h2>
            
            <div className="max-w-md mx-auto mb-12">
              <div className="card-premium p-8 text-center group hover:border-primary/50 transition-colors">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <p className="text-small uppercase tracking-wider mb-2 text-muted-foreground">
                  Faturamento
                </p>
                <p className="font-semibold text-foreground text-2xl">
                  R$ 100k–400k/mês
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="card-premium p-6">
                <h3 className="font-semibold text-primary mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Já Possuem
                </h3>
                <ul className="space-y-2">
                  {icpHas.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-body">
                      <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Problema Principal
                </h3>
                <ul className="space-y-2">
                  {icpProblems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-body">
                      <XCircle className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-premium p-6">
                <h3 className="font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Quem NÃO Entra
                </h3>
                <ul className="space-y-2">
                  {whoIsNot.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-muted-foreground">
                      <Shield className="h-4 w-4 mt-1 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Duração e Formato */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Duração e Formato
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="card-premium p-6 text-center">
                <RefreshCw className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="font-semibold text-foreground">Produto Recorrente</p>
                <p className="text-small text-muted-foreground">Direção contínua</p>
              </div>
              <div className="card-premium p-6 text-center">
                <Clock className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="font-semibold text-foreground">Mínimo: 6 meses</p>
                <p className="text-small text-muted-foreground">Recomendado</p>
              </div>
              <div className="card-premium p-6 text-center">
                <Calendar className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="font-semibold text-foreground">Ideal: 12 meses</p>
                <p className="text-small text-muted-foreground">Melhor resultado</p>
              </div>
              <div className="card-premium p-6 text-center">
                <ArrowRight className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="font-semibold text-foreground">Renovável</p>
                <p className="text-small text-muted-foreground">Automaticamente</p>
              </div>
            </div>
            <p className="text-center text-muted-foreground mt-8">
              Integração direta com UNV Core ou Sales Acceleration
            </p>
          </div>
        </div>
      </section>

      {/* Objetivo Central */}
      <section className="section-padding bg-card border-y border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-20 pointer-events-none" />
        <div className="container-premium relative">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">
              Objetivo Central do UNV Control
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Sustentar <span className="text-primary font-semibold">execução, disciplina e foco comercial</span>, evitando que:
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="p-6 bg-background rounded-xl border border-border">
                <XCircle className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-foreground font-medium">O processo morra</p>
              </div>
              <div className="p-6 bg-background rounded-xl border border-border">
                <Users className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-foreground font-medium">O time relaxe</p>
              </div>
              <div className="p-6 bg-background rounded-xl border border-border">
                <UserCheck className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-foreground font-medium">O dono volte para o operacional</p>
              </div>
              <div className="p-6 bg-background rounded-xl border border-border">
                <RefreshCw className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-foreground font-medium">O comercial vire improviso novamente</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Estrutura de Entrega - 5 Pilares */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Estrutura de Entrega — 5 Pilares
            </h2>
            <p className="text-body text-lg max-w-2xl mx-auto">
              Tudo que você precisa para manter a execução comercial no trilho, mês após mês.
            </p>
          </div>

          <div className="space-y-8 max-w-5xl mx-auto">
            {pillars.map((pillar, i) => (
              <div 
                key={i} 
                className="card-premium p-8 group hover:border-primary/50 transition-all"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Pillar number and icon */}
                  <div className="flex items-start gap-4 lg:w-48 flex-shrink-0">
                    <div className="text-4xl font-display font-bold text-primary/30">
                      {pillar.number}
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <pillar.icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-xl mb-2">
                      {pillar.title}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {pillar.description}
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-small font-semibold text-primary mb-2">O que a UNV faz:</p>
                        <ul className="space-y-1">
                          {pillar.whatWeDo.map((item, j) => (
                            <li key={j} className="flex items-center gap-2 text-small">
                              <CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              <span className="text-muted-foreground">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="mb-3">
                          <p className="text-small font-semibold text-primary mb-1">Frequência:</p>
                          <p className="text-small text-muted-foreground">{pillar.frequency}</p>
                        </div>
                        <div className="mb-3">
                          <p className="text-small font-semibold text-primary mb-1">Entregáveis:</p>
                          <p className="text-small text-muted-foreground">{pillar.deliverables}</p>
                        </div>
                        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                          <p className="text-small font-medium text-foreground">
                            💡 "{pillar.gain}"
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* AI Advisor Limits */}
          <div className="max-w-3xl mx-auto mt-8">
            <div className="p-4 bg-secondary rounded-xl">
              <p className="text-small text-center text-muted-foreground">
                <span className="font-semibold">Limites do AI Advisor:</span> {aiAdvisorLimits.join(" • ")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Cadência Operacional */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Cadência Operacional
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {cadence.map((item, i) => (
                <div key={i} className="card-premium p-6 text-center group hover:border-primary/50 transition-colors">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <item.icon className="h-7 w-7 text-primary" />
                  </div>
                  <p className="text-primary font-semibold text-lg mb-4">
                    {item.period}
                  </p>
                  <ul className="space-y-2 text-left">
                    {item.items.map((action, j) => (
                      <li key={j} className="flex items-start gap-2 text-small">
                        <CheckCircle className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Gains */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Ganhos Reais do UNV Control
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-primary mb-6 text-lg">Ganhos Imediatos</h3>
                <div className="space-y-4">
                  {immediateGains.map((gain, i) => (
                    <div key={i} className="card-premium p-4 group hover:border-primary/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <gain.icon className="h-6 w-6 text-primary flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">{gain.title}</h4>
                          <p className="text-small text-muted-foreground">{gain.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-6 text-lg">Ganhos Estruturais</h3>
                <div className="space-y-4">
                  {structuralGains.map((gain, i) => (
                    <div key={i} className="card-premium p-4 group hover:border-primary/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <gain.icon className="h-6 w-6 text-primary flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">{gain.title}</h4>
                          <p className="text-small text-muted-foreground">{gain.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's NOT Included */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              O Que o UNV Control NÃO Entrega
            </h2>
            <p className="text-body text-center mb-12">
              👉 Ele sustenta o que já foi construído.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {notIncluded.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 bg-background rounded-lg border border-border"
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
        <div className="container-premium text-center relative">
          <h2 className="heading-section text-foreground mb-6">Investimento</h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-6">
            <div>
              <p className="text-5xl md:text-6xl font-display font-bold text-primary">
                R$ 597
              </p>
              <p className="text-muted-foreground text-lg">por mês</p>
            </div>
            <div className="text-2xl text-muted-foreground">ou</div>
            <div>
              <p className="text-5xl md:text-6xl font-display font-bold text-primary">
                R$ 5.997
              </p>
              <p className="text-muted-foreground text-lg">por ano</p>
            </div>
          </div>
          <p className="text-muted-foreground/60 text-sm mb-10 max-w-md mx-auto">
            Resultados dependem da execução. UNV direciona e cobra — o cliente executa.
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
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-small uppercase tracking-wider text-muted-foreground mb-4">
              Caminho Natural Após o Control
            </p>
            <h2 className="heading-section text-foreground mb-6">
              Após o UNV Control, você está pronto para:
            </h2>
            <div className="grid sm:grid-cols-3 gap-6 mb-12">
              {nextProducts.map((product, i) => (
                <Link 
                  key={i} 
                  to={product.href}
                  className="card-premium p-6 text-center group hover:border-primary/50 transition-all"
                >
                  <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-small text-muted-foreground mb-4">{product.description}</p>
                  <span className="text-primary text-sm font-medium inline-flex items-center gap-1">
                    Conhecer <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final Quote */}
      <section className="py-16 bg-card border-t border-border/30">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-2xl md:text-3xl font-display font-bold text-foreground">
              "UNV Control é o que impede sua empresa de voltar para o improviso."
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
