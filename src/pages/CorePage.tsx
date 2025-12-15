import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  Target, 
  Layers, 
  Shield, 
  MessageSquare,
  FileText,
  Users,
  BarChart3,
  Clock,
  Sparkles,
  AlertTriangle,
  UserCheck,
  BookOpen,
  XCircle
} from "lucide-react";
import coreHero from "@/assets/core-hero.jpg";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";

const unvRole = [
  { title: "Diretor comercial temporário", description: "Assume a função de organizar sua área comercial" },
  { title: "Organizador do caos", description: "Coloca ordem onde antes havia improviso" },
  { title: "Definidor de regras mínimas", description: "Estabelece o básico para o time funcionar" },
  { title: "Tradutor de expectativas", description: "Alinha o que o dono espera do time" },
  { title: "Criador do primeiro padrão", description: "Documenta o processo comercial da empresa" },
];

const deliverables = [
  {
    step: "01",
    icon: FileText,
    title: "Diagnóstico Direcional Comercial",
    description: "Análise estratégica (não operacional) da sua operação comercial.",
    whatWeAnalyze: [
      "Como chegam os leads",
      "Quem atende os leads",
      "Como acontece a venda hoje",
      "Onde as vendas se perdem",
      "Qual é o papel do dono no comercial",
      "Nível de maturidade do time"
    ],
    deliverable: "Diagnóstico documentado + Lista clara de gargalos + Classificação do nível comercial",
    gain: "Agora eu sei exatamente onde está o problema."
  },
  {
    step: "02",
    icon: Layers,
    title: "Funil Comercial Base UNV",
    description: "Desenho do primeiro funil comercial funcional da empresa.",
    whatWeAnalyze: [
      "Etapas claras do funil",
      "Critérios de passagem entre etapas",
      "O que é avanço real vs. ilusão de progresso",
      "Onde o vendedor deve focar energia"
    ],
    deliverable: "Funil desenhado (visual) + Descrição de cada etapa + Critérios mínimos de conversão",
    gain: "Agora eu sei se estamos vendendo ou só conversando."
  },
  {
    step: "03",
    icon: MessageSquare,
    title: "Scripts Comerciais Essenciais",
    description: "Scripts mínimos obrigatórios para o time vender sem improvisar.",
    whatWeAnalyze: [
      "Primeiro contato (WhatsApp / ligação)",
      "Qualificação inicial",
      "Condução de reunião",
      "Follow-up básico",
      "Reengajamento de lead perdido"
    ],
    deliverable: "5 scripts prontos para uso imediato",
    gain: "Meus vendedores sabem o que falar."
  },
  {
    step: "04",
    icon: Target,
    title: "Metas e Indicadores Básicos",
    description: "Definição do mínimo de controle necessário.",
    whatWeAnalyze: [
      "Meta mensal global",
      "Meta por vendedor",
      "Leads atendidos",
      "Reuniões realizadas",
      "Propostas enviadas",
      "Vendas fechadas"
    ],
    deliverable: "Planilha de metas + Definição clara do que cobrar",
    gain: "Agora eu sei se o problema é esforço ou método."
  },
  {
    step: "05",
    icon: Clock,
    title: "Rotina Comercial Mínima",
    description: "Criação da rotina mínima de gestão comercial.",
    whatWeAnalyze: [
      "O que o vendedor faz todo dia",
      "O que o gestor cobra toda semana",
      "O que o dono acompanha todo mês"
    ],
    deliverable: "Agenda semanal + Roteiro de reunião semanal + Checklist de cobrança",
    gain: "O comercial deixou de ser aleatório."
  },
  {
    step: "06",
    icon: BookOpen,
    title: "Playbook Comercial Base",
    description: "Documento que organiza tudo que foi definido.",
    whatWeAnalyze: [
      "Funil completo",
      "Todos os scripts",
      "Metas definidas",
      "Rotina documentada",
      "Regras básicas",
      "Papéis claros"
    ],
    deliverable: "Playbook completo da operação comercial",
    gain: "Se alguém sair, o processo fica."
  }
];

const immediateGains = [
  { icon: CheckCircle, title: "Clareza total", description: "Visão clara de toda a operação" },
  { icon: Layers, title: "Organização", description: "Processos estruturados e documentados" },
  { icon: MessageSquare, title: "Redução do improviso", description: "Scripts e roteiros padronizados" },
  { icon: Target, title: "Mais controle", description: "Indicadores e metas definidos" },
];

const structuralGains = [
  { icon: BarChart3, title: "Base pronta para crescer", description: "Fundação sólida para escalar" },
  { icon: Users, title: "Time mais alinhado", description: "Todos sabem o que fazer" },
  { icon: UserCheck, title: "Dono menos sobrecarregado", description: "Processo funciona sem você" },
];

const icp = [
  { label: "Faturamento", value: "R$ 50k–150k/mês", icon: BarChart3 },
  { label: "Time", value: "1–5 vendedores", icon: Users },
];

const icpProfile = [
  "Empresa já vende, mas não tem processo claro",
  "Não tem funil definido",
  "Não sabe exatamente o que cobrar",
  "Depende demais do dono"
];

const whoIsNot = [
  "Vendedores individuais",
  "Empresas sem time",
  "Negócios pré-validação",
  "Donos ausentes ou sem tempo mínimo para acompanhar"
];

const notIncluded = [
  "Não acelera vendas agressivamente",
  "Não garante aumento de faturamento",
  "Não treina profundamente o time",
  "Não faz acompanhamento contínuo"
];

const aiAdvisorFeatures = [
  "Tira dúvidas sobre scripts",
  "Ajuda o dono a cobrar o time",
  "Orienta execução do dia a dia",
  "Reforça rotina e regras"
];

const aiAdvisorLimits = [
  "Não analisa CRM",
  "Não prevê faturamento",
  "Não substitui gestor"
];

const nextProducts = [
  { name: "UNV Control", description: "Execução contínua", href: "/control" },
  { name: "Sales Acceleration", description: "Aceleração real", href: "/sales-acceleration" },
  { name: "Growth Room", description: "Estratégia presencial", href: "/growth-room" },
];

export default function CorePage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center hero-dark">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${coreHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary text-sm font-medium rounded-full mb-6 backdrop-blur-sm border border-primary/30">
              Commercial Foundation & Initial Direction
            </div>
            <h1 className="heading-display hero-title mb-6">
              UNV Core
            </h1>
            <p className="text-2xl md:text-3xl hero-subtitle font-medium mb-4">
              Onde o improviso comercial termina e a direção começa.
            </p>
            <p className="text-lg hero-description mb-8 max-w-2xl">
              Direção comercial inicial para organizar o básico que precisa existir 
              para que seu time consiga vender com método, clareza e controle.
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
        productNumber={1}
        productName="UNV CORE"
        tagline="Commercial Foundation"
        whatItDoes="Organiza o básico comercial da empresa para acabar com improviso."
        keyPoints={[
          "Define funil",
          "Cria scripts mínimos",
          "Estabelece metas básicas",
          "Define rotina comercial",
          "Dá clareza ao dono sobre o que cobrar"
        ]}
        arrow="É a base. Não acelera vendas, prepara o terreno."
        targetAudience={{
          revenue: "R$ 50k a R$ 150k/mês",
          team: "Times pequenos (1–5 vendedores)"
        }}
        schedule={[
          { period: "Semana 1", description: "Diagnóstico direcional" },
          { period: "Semana 2", description: "Funil + scripts" },
          { period: "Semana 3", description: "Metas + indicadores" },
          { period: "Semana 4", description: "Rotina + playbook" },
          { period: "Semanas 5–6", description: "Ajustes finais" }
        ]}
        scheduleType="weeks"
      />

      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              O Que É o UNV Core
            </h2>
            <p className="text-body text-lg max-w-3xl mx-auto mb-8">
              O UNV Core é o produto onde a UNV atua como <span className="text-primary font-semibold">direção comercial inicial</span> da empresa, 
              organizando o básico que precisa existir para que um time consiga vender com método, clareza e controle.
            </p>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="card-premium p-6 text-left">
                <CheckCircle className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold text-foreground text-lg mb-2">O que ele faz</h3>
                <p className="text-muted-foreground">
                  Cria a base estrutural para que acelerar vendas seja possível no futuro.
                </p>
              </div>
              <div className="card-premium p-6 text-left">
                <AlertTriangle className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold text-foreground text-lg mb-2">O que ele NÃO faz</h3>
                <p className="text-muted-foreground">
                  Não acelera vendas de forma agressiva. Ele prepara o terreno.
                </p>
              </div>
            </div>
            <div className="p-6 bg-primary/5 rounded-xl border border-primary/20">
              <p className="text-foreground font-medium text-lg">
                📌 Sem base, qualquer crescimento vira caos.
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
              O Papel da UNV no Core
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
                ⚠️ A UNV não executa vendas, não gerencia CRM e não participa de negociações.
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
            
            <div className="grid sm:grid-cols-2 gap-8 mb-12">
              {icp.map((item, i) => (
                <div key={i} className="card-premium p-8 text-center group hover:border-primary/50 transition-colors">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <item.icon className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-small uppercase tracking-wider mb-2 text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="font-semibold text-foreground text-2xl">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Quem É Cliente Ideal
                </h3>
                <p className="text-muted-foreground mb-4">Donos de empresas (decisores) onde:</p>
                <ul className="space-y-2">
                  {icpProfile.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-body">
                      <CheckCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  Quem NÃO É Cliente
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
                <Clock className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="font-semibold text-foreground">Produto Pontual</p>
                <p className="text-small text-muted-foreground">Não é assinatura</p>
              </div>
              <div className="card-premium p-6 text-center">
                <FileText className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="font-semibold text-foreground">4 a 6 Semanas</p>
                <p className="text-small text-muted-foreground">Entrega estruturada</p>
              </div>
              <div className="card-premium p-6 text-center">
                <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="font-semibold text-foreground">Acesso Contínuo</p>
                <p className="text-small text-muted-foreground">Aos materiais</p>
              </div>
              <div className="card-premium p-6 text-center">
                <ArrowRight className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="font-semibold text-foreground">Porta de Entrada</p>
                <p className="text-small text-muted-foreground">Para produtos maiores</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Objetivo Central */}
      <section className="section-padding bg-card border-y border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-20 pointer-events-none" />
        <div className="container-premium relative">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">
              Objetivo Central do UNV Core
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Criar uma <span className="text-primary font-semibold">estrutura comercial mínima funcional</span>, onde:
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="p-6 bg-background rounded-xl border border-border">
                <Target className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-foreground font-medium">O dono sabe o que cobrar</p>
              </div>
              <div className="p-6 bg-background rounded-xl border border-border">
                <Users className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-foreground font-medium">O vendedor sabe o que fazer</p>
              </div>
              <div className="p-6 bg-background rounded-xl border border-border">
                <Layers className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-foreground font-medium">A empresa para de improvisar</p>
              </div>
              <div className="p-6 bg-background rounded-xl border border-border">
                <BarChart3 className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-foreground font-medium">As vendas deixam de ser "no escuro"</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables - Passo a Passo */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="text-center mb-16">
            <h2 className="heading-section text-foreground mb-4">
              Estrutura de Entrega — Passo a Passo
            </h2>
            <p className="text-body text-lg max-w-2xl mx-auto">
              6 etapas estruturadas para organizar sua operação comercial do zero.
            </p>
          </div>

          <div className="space-y-8 max-w-5xl mx-auto">
            {deliverables.map((item, i) => (
              <div 
                key={i} 
                className="card-premium p-8 group hover:border-primary/50 transition-all"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Step number and icon */}
                  <div className="flex items-start gap-4 lg:w-48 flex-shrink-0">
                    <div className="text-4xl font-display font-bold text-primary/30">
                      {item.step}
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-xl mb-2">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {item.description}
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-small font-semibold text-primary mb-2">O que analisamos/entregamos:</p>
                        <ul className="space-y-1">
                          {item.whatWeAnalyze.map((detail, j) => (
                            <li key={j} className="flex items-center gap-2 text-small">
                              <CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              <span className="text-muted-foreground">{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="mb-4">
                          <p className="text-small font-semibold text-primary mb-1">Entregável:</p>
                          <p className="text-small text-muted-foreground">{item.deliverable}</p>
                        </div>
                        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                          <p className="text-small font-medium text-foreground">
                            💡 "{item.gain}"
                          </p>
                        </div>
                      </div>
                    </div>
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
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="heading-card text-foreground mb-3">
                    UNV AI Advisor — Nível Core
                  </h3>
                  <p className="text-body text-lg mb-6">
                    Camada de suporte operacional inclusa durante todo o período do Core.
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <p className="text-small font-semibold text-primary mb-3">O que a IA faz:</p>
                      <div className="space-y-2">
                        {aiAdvisorFeatures.map((feature, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-primary" />
                            <span className="text-small">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-small font-semibold text-muted-foreground mb-3">Limites:</p>
                      <div className="space-y-2">
                        {aiAdvisorLimits.map((limit, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                            <span className="text-small text-muted-foreground">{limit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gains */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Ganhos Reais do UNV Core
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-primary mb-6 text-lg">Ganhos Imediatos</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {immediateGains.map((gain, i) => (
                    <div key={i} className="card-premium p-4 group hover:border-primary/50 transition-colors">
                      <gain.icon className="h-6 w-6 text-primary mb-2" />
                      <h4 className="font-semibold text-foreground mb-1">{gain.title}</h4>
                      <p className="text-small text-muted-foreground">{gain.description}</p>
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
              O Que o UNV Core NÃO Entrega
            </h2>
            <p className="text-body text-center mb-12">
              O Core prepara o terreno. Para aceleração real, combine com outros produtos.
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
          <p className="text-5xl md:text-6xl font-display font-bold text-primary mb-2">
            R$ 997 a R$ 1.997
          </p>
          <p className="text-muted-foreground text-lg mb-4">
            Pagamento único • Produto de entrada oficial da UNV
          </p>
          <p className="text-muted-foreground/60 text-sm mb-10 max-w-md mx-auto">
            Valor varia conforme complexidade da operação. Resultados dependem da execução do cliente.
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
              Caminho Natural Após o Core
            </p>
            <h2 className="heading-section text-foreground mb-6">
              Após o UNV Core, você está apto para:
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
              "UNV Core é onde o improviso comercial termina e a direção começa."
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
