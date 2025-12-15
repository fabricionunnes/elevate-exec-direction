import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  XCircle,
  Shield, 
  Users,
  Target,
  FileText,
  BarChart3,
  Clock,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Zap,
  UserCheck,
  Bot,
  LineChart,
  Settings,
  Phone,
  Calendar,
  MessageSquare,
  PhoneCall,
  UserPlus,
  ClipboardCheck,
  Handshake,
  RefreshCw,
  Percent
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";
import logoSalesForce from "@/assets/logo-sales-force.png";

// Papel da UNV no Sales Force
const papelUNV = [
  { icon: Phone, text: "SDR — Primeiro contato e qualificação" },
  { icon: Handshake, text: "Closer — Condução de reuniões e fechamento" },
  { icon: ClipboardCheck, text: "Gestão de pipeline e follow-up" },
  { icon: BarChart3, text: "Relatórios de performance" },
  { icon: RefreshCw, text: "Ajustes semanais de rota" },
];

// Critérios de entrada obrigatórios
const criteriosEntrada = [
  { icon: Target, text: "200 leads qualificados por mês (comprovados)" },
  { icon: TrendingUp, text: "Investimento mínimo de R$ 2.000/mês em tráfego pago" },
  { icon: CheckCircle, text: "Oferta validada" },
  { icon: Percent, text: "Ticket mínimo compatível com comissão" },
  { icon: Settings, text: "Estrutura mínima (agenda, contrato, meios de pagamento)" },
];

// ICP - Quem é cliente ideal
const icpIdeal = [
  "Empresas faturando R$ 100k a R$ 1M+/mês",
  "Negócios com leads recorrentes",
  "Gargalo de conversão identificado",
  "Time interno fraco ou inexistente",
  "Donos que querem vender mais agora",
  "Buscam previsibilidade de resultado",
  "Querem execução profissional",
];

// Quem NÃO entra
const icpNao = [
  "Quem quer 'testar'",
  "Quem não gera leads",
  "Quem não investe em tráfego",
  "Quem quer terceirizar decisão estratégica",
  "Negócios imaturos",
];

// Formato
const formato = [
  { label: "Modelo", value: "Terceirização de SDR + Closer" },
  { label: "Fixo", value: "R$ 6.000/mês" },
  { label: "Variável", value: "Comissão sobre vendas" },
  { label: "Contrato mínimo", value: "3 meses" },
];

// Rotina do SDR
const rotinaSDR = [
  "Primeiro contato com o lead",
  "Qualificação real",
  "Organização de informações",
  "Agendamento de reuniões",
  "Descarte de lead ruim",
];

// Rotina do Closer
const rotinaCloser = [
  "Condução da reunião de vendas",
  "Diagnóstico consultivo",
  "Apresentação da oferta",
  "Gestão de objeções",
  "Fechamento e follow-up",
];

// Fases de entrega
const fases = [
  {
    numero: "1",
    titulo: "Onboarding (Obrigatório)",
    icon: FileText,
    objetivo: "Garantir que a UNV venda do jeito certo, com base na realidade do negócio.",
    oQueUNVFaz: [
      "Entendimento profundo da oferta",
      "Alinhamento de ICP",
      "Ajuste de discurso comercial",
      "Definição de critérios de qualificação",
      "Definição de metas",
    ],
    entregaveis: [
      "Script adaptado à oferta",
      "Fluxo de SDR → Closer",
      "Definição de métricas",
      "Regras de atuação",
    ],
  },
  {
    numero: "2",
    titulo: "Operação Comercial",
    icon: PhoneCall,
    objetivo: "Execução diária da operação de vendas.",
    oQueUNVFaz: [
      "Atendimento diário dos leads",
      "Qualificação ativa",
      "Registro de informações",
      "Agendamento eficiente",
      "Reuniões de venda",
      "Follow-up estruturado",
      "Recuperação de oportunidades",
      "Fechamento",
    ],
    entregaveis: [
      "Rotina SDR ativa",
      "Rotina Closer ativa",
      "Pipeline organizado",
    ],
  },
  {
    numero: "3",
    titulo: "Gestão e Controle",
    icon: BarChart3,
    objetivo: "Garantir padrão e ajustar continuamente.",
    oQueUNVFaz: [
      "Padrão de abordagem",
      "Organização do pipeline",
      "Relatórios de performance",
      "Ajustes semanais de rota",
    ],
    entregaveis: [
      "Relatório mensal de performance",
      "Decisões baseadas em dados",
      "Ajustes contínuos",
    ],
  },
];

// Métricas acompanhadas
const metricas = [
  "Leads atendidos",
  "Leads qualificados",
  "Reuniões realizadas",
  "Propostas enviadas",
  "Vendas fechadas",
  "Taxa de conversão",
];

// O que NÃO faz
const naoFaz = [
  "Não gera leads",
  "Não cria oferta",
  "Não define preço",
  "Não faz marketing",
  "Não substitui direção estratégica",
  "Não cuida de pós-venda, CS ou churn",
];

// Cadência operacional
const cadencia = [
  { freq: "Diário", acao: "Atendimento e vendas" },
  { freq: "Semanal", acao: "Ajustes de rota" },
  { freq: "Mensal", acao: "Relatório e decisão" },
];

// Próximos produtos
const proximosProdutos = [
  { nome: "UNV Ads", descricao: "Gerar demanda qualificada", href: "/ads" },
  { nome: "UNV Control", descricao: "Disciplina de execução", href: "/control" },
  { nome: "UNV Sales Acceleration", descricao: "Time próprio preparado", href: "/sales-acceleration" },
];

export default function SalesForcePage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-block p-3 bg-white/95 rounded-xl shadow-lg mb-6">
              <img src={logoSalesForce} alt="UNV Sales Force" className="h-16 md:h-20" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary text-sm font-medium rounded-full mb-6 backdrop-blur-sm border border-primary/30">
              <Users className="h-4 w-4" />
              Outsourced SDR & Closing Operation
            </div>
            <p className="text-2xl md:text-3xl text-foreground/90 font-medium mb-4">
              Quando sua empresa já tem demanda — e precisa de execução profissional.
            </p>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
              A solução da UNV para empresas que geram demanda qualificada, 
              mas não conseguem converter em vendas de forma consistente.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/apply">
                <Button variant="hero" size="xl">
                  Aplicar Agora
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link to="/products">
                <Button variant="outline" size="xl" className="border-primary/30 text-foreground hover:bg-primary/10">
                  Ver Todos os Produtos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trail Summary */}
      <ProductTrailSummary
        color="red"
        productNumber={11}
        productName="UNV SALES FORCE"
        tagline="Outsourced SDR & Closing"
        whatItDoes="Converte demanda existente em vendas reais com SDR e Closer terceirizados."
        keyPoints={[
          "SDR UNV qualificando leads",
          "Closer UNV fechando vendas",
          "Follow-up estruturado",
          "Gestão de pipeline",
          "Comissão sobre vendas"
        ]}
        arrow="A UNV executa a venda."
        targetAudience={{
          revenue: "R$ 100k a R$ 1M+/mês",
          team: "Leads recorrentes + gargalo de conversão"
        }}
        schedule={[
          { period: "Onboarding", description: "Alinhamento de oferta e metas" },
          { period: "Diário", description: "Atendimento e vendas" },
          { period: "Semanal", description: "Ajustes de rota" },
          { period: "Mensal", description: "Relatório de performance" }
        ]}
        scheduleType="recurring"
      />

      {/* Posicionamento */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="heading-section text-foreground mb-6">
                Posicionamento Oficial
              </h2>
              <p className="text-body text-lg max-w-3xl mx-auto">
                O UNV Sales Force é a solução da UNV para empresas que já geram demanda qualificada, 
                mas não conseguem converter em vendas de forma consistente, seja por falta de time, 
                falta de gestão ou baixa performance interna.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="card-premium p-6 bg-accent/5 border-accent/20">
                <p className="text-foreground font-medium text-lg">
                  📌 Aqui a UNV executa a venda, não apenas direciona.
                </p>
              </div>
              <div className="card-premium p-6 bg-primary/5 border-primary/20">
                <p className="text-foreground font-medium text-lg">
                  ⚠️ Diferente dos outros produtos: a UNV atua diretamente na operação.
                </p>
              </div>
            </div>

            <div className="card-premium p-6 bg-destructive/5 border-destructive/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                <div>
                  <p className="text-foreground font-semibold mb-2">Regra de Ouro</p>
                  <p className="text-muted-foreground">
                    Sales Force só funciona quando o problema NÃO é demanda. 
                    Se o cliente não gera leads suficientes ou gera lead ruim, ele NÃO entra no Sales Force.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Critérios de Entrada */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Critérios Obrigatórios de Entrada
            </h2>
            <p className="text-body text-center mb-8 max-w-2xl mx-auto">
              Para contratar o UNV Sales Force, o cliente precisa cumprir <span className="font-bold text-foreground">TODOS</span>:
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {criteriosEntrada.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 card-premium bg-accent/5 border-accent/20">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5 text-accent" />
                  </div>
                  <span className="text-foreground font-medium text-sm">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4 text-sm">
              <span className="px-3 py-1 bg-destructive/10 text-destructive font-medium rounded-full">
                ⚠️ Sem exceções
              </span>
              <span className="px-3 py-1 bg-destructive/10 text-destructive font-medium rounded-full">
                ⚠️ Não negociável
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ICP */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              ICP Ultra Definido
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Quem É */}
              <div className="card-premium p-8 bg-accent/5 border-accent/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                    <UserCheck className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground text-xl">Quem É o Cliente Ideal</h3>
                </div>
                <ul className="space-y-3">
                  {icpIdeal.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Quem NÃO É */}
              <div className="card-premium p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <h3 className="font-semibold text-foreground text-xl">Quem NÃO Entra</h3>
                </div>
                <ul className="space-y-3">
                  {icpNao.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Objetivo Central */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              Objetivo Central do UNV Sales Force
            </h2>
            <p className="text-xl text-foreground mb-8 max-w-3xl mx-auto">
              Converter demanda existente em vendas reais.
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
              {[
                { icon: PhoneCall, text: "Abordagem profissional" },
                { icon: RefreshCw, text: "Follow-up estruturado" },
                { icon: Handshake, text: "Fechamento consistente" },
                { icon: LineChart, text: "Previsibilidade de resultado" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 card-premium">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5 text-accent" />
                  </div>
                  <span className="text-foreground font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Como a UNV Atua */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Como a UNV Atua na Prática
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              No Sales Force, a UNV assume funções operacionais claras:
            </p>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {/* SDR */}
              <div className="card-premium p-8 bg-blue-500/5 border-blue-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Phone className="h-6 w-6 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-foreground text-xl">SDR UNV</h3>
                </div>
                <ul className="space-y-3">
                  {rotinaSDR.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Closer */}
              <div className="card-premium p-8 bg-green-500/5 border-green-500/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Handshake className="h-6 w-6 text-green-500" />
                  </div>
                  <h3 className="font-semibold text-foreground text-xl">Closer UNV</h3>
                </div>
                <ul className="space-y-3">
                  {rotinaCloser.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 p-4 bg-muted/50 border border-border/30 rounded-xl text-center">
              <p className="text-muted-foreground text-sm">
                ⚠️ A UNV não cuida de pós-venda, não faz CS, não gerencia churn.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Fases de Entrega */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Estrutura de Entrega — Nível Máximo
            </h2>
            
            <div className="space-y-8">
              {fases.map((fase, i) => {
                const Icon = fase.icon;
                return (
                  <div key={i} className="card-premium p-8">
                    <div className="flex items-start gap-6">
                      <div className="w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl font-bold text-accent">{fase.numero}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <Icon className="h-6 w-6 text-accent" />
                          <h3 className="font-semibold text-foreground text-xl">{fase.titulo}</h3>
                        </div>
                        <p className="text-muted-foreground mb-6">{fase.objetivo}</p>
                        
                        <div className="grid md:grid-cols-2 gap-6">
                          <div>
                            <p className="text-sm font-medium text-accent mb-3">O que a UNV faz:</p>
                            <ul className="space-y-2">
                              {fase.oQueUNVFaz.map((item, j) => (
                                <li key={j} className="flex items-start gap-2 text-sm">
                                  <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                  <span className="text-foreground">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-primary mb-3">Entregáveis:</p>
                            <ul className="space-y-2">
                              {fase.entregaveis.map((item, j) => (
                                <li key={j} className="flex items-start gap-2 text-sm">
                                  <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                  <span className="text-foreground">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Métricas e Comissão */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Metas, Métricas e Comissão
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="card-premium p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground text-xl">Métricas Acompanhadas</h3>
                </div>
                <ul className="space-y-3">
                  {metricas.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-premium p-8 bg-accent/5 border-accent/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                    <Percent className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground text-xl">Comissão</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">Percentual definido em contrato</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">Incide apenas sobre vendas realizadas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">Regras claras de elegibilidade</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">Pagamento mensal</span>
                  </li>
                </ul>
              </div>
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
            
            <div className="grid sm:grid-cols-3 gap-4">
              {cadencia.map((item, i) => (
                <div key={i} className="card-premium p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-6 w-6 text-accent" />
                  </div>
                  <p className="text-lg font-bold text-foreground mb-2">{item.freq}</p>
                  <p className="text-muted-foreground text-sm">{item.acao}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* O que NÃO faz */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-8">
              O que o UNV Sales Force NÃO Faz
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              Ele vende dentro de um sistema já validado.
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {naoFaz.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 card-premium">
                  <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Investimento */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Investimento
            </h2>
            
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="card-premium p-8 text-center bg-accent/5 border-accent/20">
                <p className="text-small uppercase tracking-wider text-muted-foreground mb-2">
                  Fixo
                </p>
                <p className="text-3xl font-bold text-foreground mb-2">R$ 6.000</p>
                <p className="text-muted-foreground">/mês</p>
              </div>
              <div className="card-premium p-8 text-center bg-primary/5 border-primary/20">
                <p className="text-small uppercase tracking-wider text-muted-foreground mb-2">
                  Variável
                </p>
                <p className="text-xl font-bold text-foreground mb-2">Comissão</p>
                <p className="text-muted-foreground">sobre vendas (contrato)</p>
              </div>
              <div className="card-premium p-8 text-center">
                <p className="text-small uppercase tracking-wider text-muted-foreground mb-2">
                  Tráfego (cliente)
                </p>
                <p className="text-xl font-bold text-foreground mb-2">Mín. R$ 2.000</p>
                <p className="text-muted-foreground">/mês em mídia</p>
              </div>
            </div>

            <div className="mt-8 p-6 card-premium text-center">
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">Contrato mínimo recomendado:</span> 3 meses
                <br />
                <span className="text-sm">Avaliação de performance contínua. Rescisão se critérios deixarem de ser atendidos.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Como se encaixa */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-8">
              Como o Sales Force se Encaixa na UNV
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              {proximosProdutos.map((produto, i) => (
                <Link key={i} to={produto.href} className="card-premium p-6 hover:border-accent/30 transition-all group">
                  <p className="text-small text-muted-foreground mb-2">
                    {i === 0 ? "Pode ser precedido por" : i === 1 ? "Pode ser combinado com" : "Pode evoluir para"}
                  </p>
                  <h3 className="font-semibold text-foreground text-lg mb-2 group-hover:text-accent transition-colors">
                    {produto.nome}
                  </h3>
                  <p className="text-muted-foreground text-sm">{produto.descricao}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="section-padding bg-gradient-to-br from-accent/5 via-background to-primary/5">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              UNV Sales Force entra quando sua empresa já tem demanda — 
              e precisa de execução profissional.
            </h2>
            <p className="text-body text-lg mb-8">
              Pronto para converter mais com um time de vendas dedicado?
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/apply">
                <Button variant="hero" size="xl">
                  Aplicar para UNV Sales Force
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link to="/compare">
                <Button variant="outline" size="xl" className="border-primary/30 text-foreground hover:bg-primary/10">
                  Comparar Produtos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
