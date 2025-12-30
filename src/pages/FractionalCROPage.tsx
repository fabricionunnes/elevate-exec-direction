import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  XCircle,
  Users,
  Calendar,
  Clock,
  Target,
  BarChart3,
  MessageSquare,
  TrendingUp,
  Settings,
  AlertTriangle,
  Zap,
  DollarSign,
  Building2,
  UserCheck,
  CalendarDays,
  ClipboardList,
  PieChart,
  Layers,
  Phone
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";
import { ROISimulator } from "@/components/ROISimulator";
import logoFractionalCRO from "@/assets/logo-fractional-cro.png";
import salarioDiretorComercial from "@/assets/salario-diretor-comercial.png";

// Rotina fixa
const rotinaDiaria = {
  title: "Reunião diária com vendedores",
  frequency: "Segunda a sexta",
  duration: "15–30 minutos",
  focus: [
    "Pipeline",
    "Atividades do dia",
    "Gargalos imediatos",
    "Cobrança de execução"
  ],
  objetivo: "Criar ritmo e disciplina comercial."
};

const acompanhamentoContinuo = {
  title: "Acompanhamento contínuo",
  items: [
    {
      icon: "MessageSquare",
      title: "Grupo de WhatsApp",
      description: "Acompanhamento diário através de grupo exclusivo"
    },
    {
      icon: "Phone",
      title: "Ligações pontuais",
      description: "Chamadas quando necessário para correções imediatas"
    },
    {
      icon: "AlertTriangle",
      title: "Ponto de controle",
      description: "Intervenção com vendedores abaixo da projeção da meta"
    },
    {
      icon: "CalendarDays",
      title: "Acompanhamento semanal",
      description: "Follow-up estruturado com cada vendedor"
    }
  ]
};

const rotinaSemanal = {
  title: "Reunião semanal com o proprietário",
  frequency: "1x por semana",
  duration: "60 minutos",
  focus: [
    "Análise de números",
    "Decisões estratégicas",
    "Correção de rota",
    "Prioridades da semana"
  ],
  objetivo: "Tirar o dono do operacional e levar decisão com base em dados."
};

const rotinaMensal = {
  title: "Reunião mensal de fechamento",
  frequency: "1x por mês",
  duration: "90 minutos",
  focus: [
    "Metas x resultados",
    "Análise do funil",
    "Performance individual",
    "Definição de metas do próximo mês"
  ],
  objetivo: "Previsibilidade e aprendizado contínuo."
};

// Escopo de entrega
const escopoEntrega = [
  {
    icon: Target,
    title: "Direção Comercial Ativa",
    items: [
      "Definição e cobrança de metas",
      "Gestão diária do pipeline",
      "Análise de conversão",
      "Priorização de atividades comerciais"
    ]
  },
  {
    icon: Users,
    title: "Gestão do Time de Vendas",
    items: [
      "Cobrança de execução",
      "Correção de comportamento",
      "Ajustes de discurso",
      "Desenvolvimento prático dos vendedores"
    ]
  },
  {
    icon: BarChart3,
    title: "Gestão de Indicadores",
    items: [
      "Leads",
      "Conversão por etapa",
      "Ticket médio",
      "Ciclo de vendas",
      "Forecast semanal",
      "Resultado mensal"
    ]
  },
  {
    icon: Settings,
    title: "Estruturação (quando necessário)",
    items: [
      "Ajustes de funil",
      "Ajustes de metas",
      "Ajustes de processo",
      "Interface com outros produtos UNV"
    ]
  }
];

// O que NÃO está incluso
const naoIncluso = [
  "Execução de tráfego pago",
  "Execução de social media",
  "SDR terceirizado (outro produto)",
  "Contratação/demissão direta",
  "Gestão de RH ou financeiro"
];

// Problemas resolvidos
const problemas = [
  { icon: XCircle, text: "Não existe cobrança diária" },
  { icon: XCircle, text: "Vendedores trabalham sem ritmo" },
  { icon: XCircle, text: "Metas não são acompanhadas de perto" },
  { icon: XCircle, text: "O dono vira o 'chefe de vendas'" },
  { icon: XCircle, text: "Decisões comerciais são reativas" },
];

// Resultados
const resultados = [
  { icon: AlertTriangle, text: "Metas não batidas", tipo: "problema" },
  { icon: AlertTriangle, text: "Previsibilidade zero", tipo: "problema" },
  { icon: AlertTriangle, text: "Desgaste do proprietário", tipo: "problema" },
];

// Resultados esperados
const resultadosEsperados = [
  {
    periodo: "Primeiros 30 dias",
    items: [
      "Rotina implantada",
      "Pipeline organizado",
      "Metas claras",
      "Time sob cobrança"
    ]
  },
  {
    periodo: "60–90 dias",
    items: [
      "Aumento de conversão",
      "Previsibilidade mínima",
      "Redução de dependência do dono"
    ]
  }
];

// ICP
const icpPara = [
  "Empresas B2B e B2C",
  "Faturamento mensal: R$ 50 mil a R$ 2 milhões+",
  "Time de vendas ativo (2 a 8 vendedores)",
  "Dono cansado de cobrar vendas"
];

const icpNaoPara = [
  "Empresa sem vendedores",
  "Dono que não aceita cobrança",
  "Negócio informal"
];

// Frases de venda
const frasesVenda = [
  "Hoje quem dirige suas vendas é quem sobra tempo.",
  "Seu time não precisa de mais treinamento, precisa de cobrança.",
  "Um diretor comercial custa R$ 30k+. Aqui você paga 4k."
];

// Conexão ecossistema
const conexaoEcossistema = [
  { nome: "UNV Sales Acceleration", descricao: "Estrutura", href: "/sales-acceleration" },
  { nome: "UNV Sales Ops", descricao: "Padronização", href: "/sales-ops" },
  { nome: "UNV Sales System", descricao: "Escala", href: "/ai-sales-system" },
  { nome: "UNV Sales Force", descricao: "Execução humana", href: "/sales-force" },
];

export default function FractionalCROPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[80vh] flex items-center bg-gradient-to-br from-background via-background to-amber-500/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-4xl mx-auto text-center animate-fade-up">
            <div className="inline-block p-4 bg-white/95 rounded-2xl shadow-xl mb-8">
              <img src={logoFractionalCRO} alt="UNV Fractional CRO" className="h-20 md:h-28" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-600 text-sm font-medium rounded-full mb-6 backdrop-blur-sm border border-amber-500/30">
              <Target className="h-4 w-4" />
              Diretor Comercial Terceirizado
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight">
              UNV Fractional CRO
            </h1>
            <p className="text-xl md:text-2xl text-foreground/80 mb-4 font-medium">
              "Você não precisa contratar um diretor comercial."
            </p>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Você precisa ter direção comercial todos os dias.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/diagnostico">
                <Button variant="hero" size="xl" className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
                  Solicitar Proposta
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link to="/products">
                <Button variant="outline" size="xl" className="border-amber-500/30 text-foreground hover:bg-amber-500/10">
                  Ver Todos os Serviços
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trail Summary */}
      <ProductTrailSummary
        color="gold"
        productNumber={0}
        productName="UNV FRACTIONAL CRO"
        tagline="Diretor Comercial Terceirizado"
        whatItDoes="Terceirização completa da função de Diretor Comercial, atuando na gestão diária do time de vendas."
        keyPoints={[
          "Reunião diária com vendedores (seg a sex)",
          "Reunião semanal com o proprietário",
          "Reunião mensal de fechamento",
          "Cobrança de metas e execução",
          "Gestão de indicadores e pipeline"
        ]}
        arrow="Direção comercial na prática, todos os dias."
        targetAudience={{
          revenue: "R$ 50k a R$ 500k/mês",
          team: "2 a 8 vendedores"
        }}
        schedule={[
          { period: "Diário", description: "Reunião com vendedores" },
          { period: "Semanal", description: "Reunião com dono" },
          { period: "Mensal", description: "Fechamento e metas" }
        ]}
        scheduleType="recurring"
      />

      {/* Posicionamento */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="heading-section text-foreground mb-6">
                O Que É o Produto
              </h2>
              <p className="text-body text-lg max-w-3xl mx-auto mb-8">
                O UNV Fractional CRO é a terceirização completa da função de Diretor Comercial, atuando na gestão diária do time de vendas, na cobrança de metas e na tomada de decisão comercial, sem os custos e riscos de uma contratação interna.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="card-premium p-6 bg-destructive/5 border-destructive/20 text-center">
                <XCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <p className="text-foreground font-medium text-lg">
                  Não é consultoria.
                </p>
              </div>
              <div className="card-premium p-6 bg-destructive/5 border-destructive/20 text-center">
                <XCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <p className="text-foreground font-medium text-lg">
                  Não é mentoria.
                </p>
              </div>
              <div className="card-premium p-6 bg-destructive/5 border-destructive/20 text-center">
                <XCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <p className="text-foreground font-medium text-lg">
                  Não é treinamento.
                </p>
              </div>
            </div>

            <div className="mt-8 card-premium p-8 bg-amber-500/10 border-amber-500/30 text-center">
              <CheckCircle className="h-12 w-12 text-amber-600 mx-auto mb-4" />
              <p className="text-2xl font-bold text-foreground">
                É direção comercial na prática, todos os dias.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Problema Real */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Problema Real Que Ele Resolve
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              Empresas com vendedores sofrem quando:
            </p>
            
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Problemas */}
              <div className="card-premium p-8">
                <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                  Sintomas do Problema
                </h3>
                <div className="space-y-4">
                  {problemas.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-destructive/5 rounded-lg border border-destructive/10">
                      <item.icon className="h-5 w-5 text-destructive" />
                      <span className="text-foreground">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resultados ruins */}
              <div className="card-premium p-8 bg-gradient-to-br from-destructive/5 to-destructive/10">
                <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                  <XCircle className="h-6 w-6 text-destructive" />
                  Resultado
                </h3>
                <div className="space-y-4">
                  {resultados.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 bg-background/80 rounded-lg border border-destructive/20">
                      <item.icon className="h-5 w-5 text-destructive" />
                      <span className="text-foreground font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como Funciona - Rotina */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Como o Produto Funciona
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              📅 Rotina fixa (não negociável)
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Diária */}
              <div className="card-premium p-6 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center mb-4">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{rotinaDiaria.title}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Clock className="h-4 w-4" />
                  <span>{rotinaDiaria.duration} • {rotinaDiaria.frequency}</span>
                </div>
                <p className="text-sm font-medium text-foreground mb-3">Foco:</p>
                <ul className="space-y-2 mb-4">
                  {rotinaDiaria.focus.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <p className="text-xs text-foreground">
                    👉 <strong>Objetivo:</strong> {rotinaDiaria.objetivo}
                  </p>
                </div>
              </div>

              {/* Semanal */}
              <div className="card-premium p-6 bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
                <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center mb-4">
                  <CalendarDays className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{rotinaSemanal.title}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Clock className="h-4 w-4" />
                  <span>{rotinaSemanal.duration} • {rotinaSemanal.frequency}</span>
                </div>
                <p className="text-sm font-medium text-foreground mb-3">Foco:</p>
                <ul className="space-y-2 mb-4">
                  {rotinaSemanal.focus.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-amber-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="p-3 bg-amber-500/10 rounded-lg">
                  <p className="text-xs text-foreground">
                    👉 <strong>Objetivo:</strong> {rotinaSemanal.objetivo}
                  </p>
                </div>
              </div>

              {/* Mensal */}
              <div className="card-premium p-6 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center mb-4">
                  <PieChart className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{rotinaMensal.title}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Clock className="h-4 w-4" />
                  <span>{rotinaMensal.duration} • {rotinaMensal.frequency}</span>
                </div>
                <p className="text-sm font-medium text-foreground mb-3">Foco:</p>
                <ul className="space-y-2 mb-4">
                  {rotinaMensal.focus.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="p-3 bg-emerald-500/10 rounded-lg">
                  <p className="text-xs text-foreground">
                    👉 <strong>Objetivo:</strong> {rotinaMensal.objetivo}
                  </p>
                </div>
              </div>
            </div>

            {/* Acompanhamento Contínuo */}
            <div className="mt-12">
              <h3 className="text-xl font-bold text-foreground text-center mb-6">
                📱 Acompanhamento Contínuo
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card-premium p-5 bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
                  <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center mb-3">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">Grupo de WhatsApp</h4>
                  <p className="text-sm text-muted-foreground">Acompanhamento diário através de grupo exclusivo</p>
                </div>
                <div className="card-premium p-5 bg-gradient-to-br from-rose-500/5 to-rose-500/10 border-rose-500/20">
                  <div className="w-10 h-10 rounded-lg bg-rose-500 flex items-center justify-center mb-3">
                    <Phone className="h-5 w-5 text-white" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">Ligações Pontuais</h4>
                  <p className="text-sm text-muted-foreground">Chamadas quando necessário para correções imediatas</p>
                </div>
                <div className="card-premium p-5 bg-gradient-to-br from-orange-500/5 to-orange-500/10 border-orange-500/20">
                  <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center mb-3">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">Ponto de Controle</h4>
                  <p className="text-sm text-muted-foreground">Intervenção com vendedores abaixo da projeção da meta</p>
                </div>
                <div className="card-premium p-5 bg-gradient-to-br from-teal-500/5 to-teal-500/10 border-teal-500/20">
                  <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center mb-3">
                    <CalendarDays className="h-5 w-5 text-white" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">Acompanhamento Semanal</h4>
                  <p className="text-sm text-muted-foreground">Follow-up estruturado com cada vendedor</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Escopo de Entrega */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-6xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Escopo de Entrega
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              O que está incluso no UNV Fractional CRO
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-12">
              {escopoEntrega.map((escopo, i) => (
                <div key={i} className="card-premium p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <escopo.icon className="h-6 w-6 text-amber-600" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{escopo.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {escopo.items.map((item, j) => (
                      <li key={j} className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* O que não está incluso */}
            <div className="card-premium p-8 bg-destructive/5 border-destructive/20">
              <h3 className="text-xl font-bold text-foreground mb-6 text-center">
                ⚠️ O Que NÃO Está Incluso (Clareza Absoluta)
              </h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {naoIncluso.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 bg-background/80 rounded-lg">
                    <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-center text-muted-foreground mt-6">
                📌 O foco é direção comercial, não operação paralela.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Perfil de Cliente Ideal
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Para quem é */}
              <div className="card-premium p-8 bg-emerald-500/5 border-emerald-500/20">
                <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                  <UserCheck className="h-6 w-6 text-emerald-600" />
                  Para quem é
                </h3>
                <ul className="space-y-4">
                  {icpPara.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 p-3 bg-background/80 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Para quem NÃO é */}
              <div className="card-premium p-8 bg-destructive/5 border-destructive/20">
                <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                  <XCircle className="h-6 w-6 text-destructive" />
                  Para quem NÃO é
                </h3>
                <ul className="space-y-4">
                  {icpNaoPara.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 p-3 bg-background/80 rounded-lg">
                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resultados Esperados */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Resultados Esperados (Realistas)
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              {resultadosEsperados.map((resultado, i) => (
                <div key={i} className="card-premium p-8 bg-amber-500/5 border-amber-500/20">
                  <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Clock className="h-6 w-6 text-amber-600" />
                    {resultado.periodo}
                  </h3>
                  <ul className="space-y-3">
                    {resultado.items.map((item, j) => (
                      <li key={j} className="flex items-center gap-3 p-3 bg-background/80 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Preço */}
      <section className="section-padding bg-gradient-to-br from-amber-500/10 via-background to-orange-500/10">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-8">
              Modelo Comercial
            </h2>
            
            <div className="card-premium p-10 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
              <div className="mb-4">
                <span className="text-6xl md:text-7xl font-bold text-foreground">R$ 4.000</span>
                <span className="text-2xl text-muted-foreground ml-2">/mês</span>
              </div>
              
              <p className="text-lg text-foreground font-medium mb-6">
                + Comissão variável e escalonável com base no atingimento de metas
              </p>

              {/* Bônus CRM */}
              <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl inline-block">
                <div className="flex items-center gap-2 justify-center">
                  <Zap className="h-5 w-5 text-emerald-600" />
                  <span className="text-foreground font-semibold">BÔNUS:</span>
                  <span className="text-emerald-600 font-bold">CRM incluso no plano</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center text-muted-foreground mb-8">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-amber-600" />
                  Sem taxa de setup
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-amber-600" />
                  Contrato mínimo: 3 meses
                </div>
              </div>

              <Link to="/diagnostico">
                <Button variant="hero" size="xl" className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
                  Quero Direção Comercial
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
            </div>

            {/* Diferencial */}
            <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div className="card-premium p-4 text-center">
                <Calendar className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Atuação diária</p>
              </div>
              <div className="card-premium p-4 text-center">
                <Target className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Cobrança real</p>
              </div>
              <div className="card-premium p-4 text-center">
                <MessageSquare className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Linguagem de vendas</p>
              </div>
              <div className="card-premium p-4 text-center">
                <DollarSign className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Sem custo CLT</p>
              </div>
              <div className="card-premium p-4 text-center bg-emerald-500/10 border-emerald-500/20">
                <ClipboardList className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">CRM incluso</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-8">
              Por Que Esse Preço Faz Sentido
            </h2>

            {/* Imagem de referência salarial */}
            <div className="mb-12 card-premium p-6 bg-secondary/50">
              <p className="text-center text-muted-foreground mb-4 text-sm">
                Salário médio de um Diretor Comercial no Brasil (fonte: pesquisa Google)
              </p>
              <div className="flex justify-center">
                <img 
                  src={salarioDiretorComercial} 
                  alt="Pesquisa salarial - Diretor Comercial no Brasil: média de R$ 15.000 a R$ 31.000 por mês" 
                  className="rounded-xl shadow-lg max-w-full md:max-w-2xl border border-border"
                />
              </div>
              <p className="text-center text-foreground font-medium mt-4">
                Média salarial: <span className="text-amber-600 font-bold">R$ 15.000 a R$ 31.000/mês</span> + encargos CLT
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="card-premium p-6 text-center">
                <DollarSign className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-2xl font-bold text-foreground mb-2">R$ 4k–6k/mês</p>
                <p className="text-muted-foreground">Custo de um SDR</p>
              </div>
              <div className="card-premium p-6 text-center">
                <Users className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-2xl font-bold text-foreground mb-2">R$ 15k+/mês</p>
                <p className="text-muted-foreground">Time mínimo</p>
              </div>
              <div className="card-premium p-6 text-center bg-amber-500/10 border-amber-500/30">
                <Target className="h-12 w-12 text-amber-600 mx-auto mb-4" />
                <p className="text-2xl font-bold text-foreground mb-2">R$ 4k/mês</p>
                <p className="text-muted-foreground">+ comissão por metas</p>
              </div>
            </div>

            <div className="card-premium p-8 bg-emerald-500/10 border-emerald-500/30">
              <h3 className="text-xl font-bold text-foreground mb-4 text-center">O UNV AI:</h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 p-3 bg-background/80 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <span className="text-foreground">Trabalha 24/7</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-background/80 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <span className="text-foreground">Não falta</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-background/80 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <span className="text-foreground">Não esquece follow-up</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-background/80 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <span className="text-foreground">Escala instantaneamente</span>
                </div>
              </div>
              <p className="text-center text-foreground font-medium mt-6">
                👉 ROI normalmente {"<"} 60 dias
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Frases de Venda */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Frases de Impacto
            </h2>
            
            <div className="space-y-6">
              {frasesVenda.map((frase, i) => (
                <div key={i} className="card-premium p-6 bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20">
                  <p className="text-xl md:text-2xl font-medium text-foreground text-center italic">
                    "{frase}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Conexão Ecossistema */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Conexão com o Ecossistema UNV
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              Upsells naturais que complementam o Fractional CRO:
            </p>

            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              {conexaoEcossistema.map((produto, i) => (
                <Link key={i} to={produto.href}>
                  <div className="card-premium p-4 text-center hover:bg-amber-500/5 transition-all duration-300 h-full">
                    <Layers className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                    <p className="font-semibold text-foreground text-sm">{produto.nome}</p>
                    <p className="text-xs text-muted-foreground">{produto.descricao}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="section-padding bg-gradient-to-br from-amber-500/20 via-background to-orange-500/20">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              "A UNV assume a direção comercial da sua empresa todos os dias."
            </h2>
            
            <Link to="/diagnostico">
              <Button variant="hero" size="xl" className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
                Quero Direção Comercial Agora
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ROI Simulator */}
      <ROISimulator
        productName="UNV Fractional CRO"
        productPrice="R$ 4.000/mês + comissão"
        productPriceValue={48000}
        productSlug="fractional-cro"
        benefitDescription="Tenha um diretor comercial atuando diariamente por uma fração do custo de uma contratação CLT. Direção real, cobrança diária, resultados mensuráveis."
        expectedConversionIncrease={10}
        expectedTicketIncrease={20}
      />
    </Layout>
  );
}
