import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  MapPin, 
  Shield, 
  Calendar, 
  Target, 
  MessageSquare,
  FileText,
  BarChart3,
  Users,
  Clock,
  Sparkles,
  Zap,
  TrendingUp,
  Layers,
  XCircle,
  Bot,
  Compass,
  Flag,
  ClipboardCheck,
  UserCheck,
  AlertTriangle,
  Search,
  Lightbulb,
  Route,
  Play,
  Settings
} from "lucide-react";
import growthRoomHero from "@/assets/growth-room-hero.jpg";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";

// O que a UNV faz no Growth Room
const papelUNV = [
  { icon: Compass, text: "Diretor comercial estratégico" },
  { icon: Target, text: "Facilitador de decisões difíceis" },
  { icon: BarChart3, text: "Tradutor de dados em decisões" },
  { icon: Users, text: "Moderador de prioridades" },
  { icon: FileText, text: "Estruturador de plano executável" },
];

// ICP - Quem é cliente ideal
const icpIdeal = [
  "Empresas faturando R$ 150k a R$ 600k/mês",
  "Dono/fundador presente",
  "Time comercial existente",
  "Crescimento travado",
  "Muitas ideias e pouca execução",
  "Falta de clareza do que priorizar",
  "Estrutura atual começando a quebrar",
];

const perfilComportamental = [
  "Dono decisor",
  "Disposto a tomar decisões",
  "Aberto a questionar o próprio modelo",
];

// Quem NÃO entra
const icpNao = [
  "Quem busca motivação",
  "Quem quer 'aprender'",
  "Quem não decide",
  "Quem quer execução terceirizada",
];

// Formato
const formato = [
  { label: "Duração", value: "3 dias presenciais intensivos" },
  { label: "Formato", value: "Grupo seleto (curadoria)" },
  { label: "Local", value: "Ambiente premium" },
  { label: "Participação", value: "Apenas decisores" },
  { label: "Pré-work", value: "Obrigatório" },
  { label: "Pós-imersão", value: "Estruturado" },
];

// Estrutura de entrega - 5 Fases
const fases = [
  {
    fase: "Fase 1",
    titulo: "Pré-Growth Room (Preparação)",
    icon: Search,
    objetivo: "Chegar no presencial com o problema certo na mesa.",
    oQueUNVFaz: [
      "Coleta informações estratégicas: faturamento, estrutura de time, funil comercial, principais gargalos",
      "Analisa maturidade comercial",
      "Identifica pontos de decisão críticos",
    ],
    entregaveis: [
      "Diagnóstico estratégico prévio",
      "Lista de hipóteses de gargalo",
      "Direcionamento inicial de foco",
    ],
    ganho: "Cheguei sabendo exatamente o que precisamos decidir.",
  },
  {
    fase: "Fase 2",
    titulo: "Dia 1 | Diagnóstico & Clareza",
    icon: Lightbulb,
    objetivo: "Entender o negócio real, não a versão idealizada.",
    oQueAcontece: [
      "Leitura profunda do modelo atual",
      "Análise do funil comercial",
      "Avaliação do time",
      "Identificação dos gargalos reais",
      "Separação de sintomas vs. causa",
    ],
    decisoes: [
      "Onde a empresa realmente perde dinheiro",
      "Onde o crescimento trava",
      "O que está sendo superestimado",
    ],
    entregaveis: [
      "Mapa de gargalos",
      "Funil redesenhado (se necessário)",
      "Lista clara de problemas prioritários",
    ],
    ganho: "Agora eu sei onde mexer primeiro.",
  },
  {
    fase: "Fase 3",
    titulo: "Dia 2 | Direção & Prioridades",
    icon: Route,
    objetivo: "Definir para onde a empresa vai e como chega lá.",
    oQueAcontece: [
      "Definição de prioridades estratégicas",
      "Escolhas difíceis: canais, produtos, foco do time",
      "Definição de metas realistas",
      "Estruturação do funil ideal",
      "Discussão de estrutura de time",
    ],
    decisoes: [
      "O que entra no foco",
      "O que sai do foco",
      "O que fica para depois",
    ],
    entregaveis: [
      "Mapa de prioridades estratégicas",
      "Metas claras",
      "KPIs obrigatórios",
      "Estrutura ideal do time",
    ],
    ganho: "Parei de tentar fazer tudo ao mesmo tempo.",
  },
  {
    fase: "Fase 4",
    titulo: "Dia 3 | Plano & Execução",
    icon: Play,
    objetivo: "Transformar estratégia em plano executável.",
    oQueAcontece: [
      "Quebra do plano em ações",
      "Definição de responsáveis",
      "Prazos claros",
      "Indicadores de acompanhamento",
      "Rituais mínimos de gestão",
    ],
    entregaveis: [
      "Plano de ação de 90 dias fechado",
      "Agenda de execução",
      "Checkpoints definidos",
      "Critérios de sucesso",
    ],
    ganho: "Saí com um plano que dá para executar.",
  },
  {
    fase: "Fase 5",
    titulo: "Pós-Growth Room (Sustentação)",
    icon: Settings,
    objetivo: "Evitar que o plano morra após o evento.",
    oQueUNVFaz: [
      "Configura o UNV AI Advisor com: decisões tomadas, prioridades, metas",
      "Define checkpoints",
      "Orienta próximos passos",
    ],
    entregaveis: [
      "AI Advisor configurado",
      "Checklists de execução",
      "Documento final consolidado",
    ],
    ganho: "O plano não ficou esquecido.",
  },
];

// Entregáveis consolidados
const entregaveisConsolidados = [
  "Diagnóstico estratégico completo",
  "Funil comercial redesenhado (se aplicável)",
  "Metas e KPIs claros",
  "Estrutura ideal de time",
  "Mapa de prioridades",
  "Plano de ação de 90 dias",
  "Direcionamento pós-imersão",
  "UNV AI Advisor configurado",
];

// Ganhos
const ganhosImediatos = [
  { icon: Zap, text: "Clareza absoluta" },
  { icon: Target, text: "Redução de ruído" },
  { icon: Compass, text: "Foco real" },
];

const ganhosEstrategicos = [
  { icon: Shield, text: "Menos decisões erradas" },
  { icon: TrendingUp, text: "Crescimento com critério" },
  { icon: Users, text: "Menos desgaste emocional" },
];

// O que NÃO entrega
const naoEntrega = [
  "Não executa o plano",
  "Não faz acompanhamento contínuo",
  "Não treina time operacionalmente",
  "Não garante crescimento",
];

// Próximos passos
const proximosProdutos = [
  { nome: "UNV Sales Acceleration", descricao: "Acelerar execução", href: "/sales-acceleration" },
  { nome: "UNV Control", descricao: "Sustentar execução", href: "/control" },
  { nome: "UNV Partners", descricao: "Direção estratégica contínua", href: "/partners" },
];

export default function GrowthRoomPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center hero-dark">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${growthRoomHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-overlay" />
        </div>
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary text-sm font-medium rounded-full mb-6 backdrop-blur-sm border border-primary/30">
              <MapPin className="h-4 w-4" />
              Imersão Presencial de Estratégia
            </div>
            <h1 className="heading-display hero-title mb-6">
              UNV Growth Room
            </h1>
            <p className="text-2xl md:text-3xl hero-subtitle font-medium mb-4">
              Onde crescer deixa de ser confuso e passa a ser decidido.
            </p>
            <p className="text-lg hero-description mb-8 max-w-2xl">
              Imersão presencial de 3 dias para decisões estratégicas.
              A UNV atua como direção comercial e de crescimento, ajudando o empresário a redefinir a rota da empresa.
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
        productNumber={4}
        productName="UNV GROWTH ROOM"
        tagline="Presencial Estratégico"
        whatItDoes="Redefine a rota de crescimento da empresa."
        keyPoints={[
          "Diagnóstico profundo",
          "Decisões difíceis",
          "Definição de foco",
          "Plano de 90 dias fechado"
        ]}
        arrow="Não executa. Decide."
        targetAudience={{
          revenue: "R$ 150k a R$ 600k/mês",
          team: "Com crescimento confuso ou travado"
        }}
        schedule={[
          { period: "Pré", description: "Diagnóstico estratégico" },
          { period: "Dia 1", description: "Gargalos reais" },
          { period: "Dia 2", description: "Direção e prioridades" },
          { period: "Dia 3", description: "Plano de 90 dias" },
          { period: "Pós", description: "Sustentação com IA" }
        ]}
        scheduleType="days"
      />

      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="heading-section text-foreground mb-6">
                Posicionamento Oficial
              </h2>
              <p className="text-body text-lg max-w-3xl mx-auto">
                O UNV Growth Room é uma imersão presencial de decisões estratégicas, onde a UNV atua como 
                direção comercial e de crescimento, ajudando o empresário a redefinir a rota da empresa.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="card-premium p-6 bg-accent/5 border-accent/20">
                <p className="text-foreground font-medium text-lg">
                  📌 Growth Room existe quando crescer sem direção começa a custar caro.
                </p>
              </div>
              <div className="card-premium p-6">
                <p className="text-muted-foreground">
                  Ele não serve para ensinar conceitos. Ele serve para <span className="text-foreground font-semibold">decidir o que fazer — e o que parar de fazer.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Papel da UNV */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              O Papel da UNV no Growth Room
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              Neste produto, a UNV atua como:
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {papelUNV.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 card-premium">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5 text-accent" />
                  </div>
                  <span className="text-foreground font-medium">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
              <p className="text-muted-foreground text-sm flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <span>
                  ⚠️ A UNV não executa, não gerencia time no dia a dia, não substitui liderança interna.
                </span>
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
                <ul className="space-y-3 mb-6">
                  {icpIdeal.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="border-t border-border/30 pt-6">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Perfil Comportamental:</p>
                  <ul className="space-y-2">
                    {perfilComportamental.map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-accent" />
                        <span className="text-foreground text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
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

      {/* Formato */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Duração, Formato e Governança
            </h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {formato.map((item, i) => (
                <div key={i} className="card-premium p-5 text-center">
                  <p className="text-small uppercase tracking-wider text-muted-foreground mb-1">
                    {item.label}
                  </p>
                  <p className="text-foreground font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Objetivo Central */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="heading-section text-foreground mb-6">
              Objetivo Central do Growth Room
            </h2>
            <p className="text-xl text-foreground mb-8 max-w-3xl mx-auto">
              Gerar clareza estratégica absoluta e um plano executável de crescimento, alinhado à realidade do negócio.
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
              {[
                "O empresário sabe onde crescer",
                "Sabe onde não crescer",
                "Sabe o que atacar primeiro",
                "Sabe o que pode esperar",
                "Sai com um plano de 90 dias fechado",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 card-premium">
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                  <span className="text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Estrutura de Entrega - 5 Fases */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Estrutura Completa de Entrega
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              5 fases que transformam estratégia em ação concreta.
            </p>

            <div className="space-y-6">
              {fases.map((fase, i) => (
                <div key={i} className="card-premium p-6 lg:p-8 bg-background">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <fase.icon className="h-7 w-7 text-accent" />
                    </div>
                    <div>
                      <p className="text-accent font-bold text-sm uppercase tracking-wider mb-1">
                        {fase.fase}
                      </p>
                      <h3 className="font-semibold text-foreground text-xl">
                        {fase.titulo}
                      </h3>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-3">Objetivo:</p>
                      <p className="text-foreground mb-4">{fase.objetivo}</p>
                      
                      {fase.oQueUNVFaz && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">O que a UNV faz:</p>
                          <ul className="space-y-2 mb-4">
                            {fase.oQueUNVFaz.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {fase.oQueAcontece && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">O que acontece:</p>
                          <ul className="space-y-2 mb-4">
                            {fase.oQueAcontece.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {fase.decisoes && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">Decisões tomadas:</p>
                          <ul className="space-y-2">
                            {fase.decisoes.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <Target className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-3">Entregáveis:</p>
                      <ul className="space-y-2 mb-6">
                        {fase.entregaveis.map((item, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <FileText className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                            <span className="text-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Ganho percebido:</p>
                        <p className="text-foreground italic">"{fase.ganho}"</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Entregáveis Consolidados */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Entregáveis Consolidados
            </h2>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {entregaveisConsolidados.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 card-premium">
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                  <span className="text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ganhos */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-12">
              Ganhos Reais do Growth Room
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Ganhos Imediatos */}
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground text-lg mb-6 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-accent" />
                  Ganhos Imediatos
                </h3>
                <div className="space-y-4">
                  {ganhosImediatos.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <item.icon className="h-5 w-5 text-accent" />
                      </div>
                      <span className="text-foreground font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ganhos Estratégicos */}
              <div className="card-premium p-6">
                <h3 className="font-semibold text-foreground text-lg mb-6 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Ganhos Estratégicos
                </h3>
                <div className="space-y-4">
                  {ganhosEstrategicos.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-foreground font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* O que NÃO entrega */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              O Que o Growth Room NÃO Entrega
            </h2>
            <p className="text-body text-center mb-8">
              👉 Ele define a rota. A execução vem depois.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {naoEntrega.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-secondary rounded-lg">
                  <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Próximos Passos */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Caminho Natural Após o Growth Room
            </h2>
            <p className="text-body text-center mb-12">
              Após o Growth Room, o cliente é direcionado para:
            </p>
            
            <div className="grid sm:grid-cols-3 gap-6">
              {proximosProdutos.map((produto, i) => (
                <Link key={i} to={produto.href} className="card-premium p-6 text-center hover:border-accent/50 transition-colors group">
                  <h3 className="font-semibold text-foreground mb-2 group-hover:text-accent transition-colors">
                    {produto.nome}
                  </h3>
                  <p className="text-muted-foreground text-sm">{produto.descricao}</p>
                </Link>
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
          <p className="text-5xl md:text-6xl font-display font-bold text-primary mb-4">
            R$ 12.000
          </p>
          <p className="text-muted-foreground text-lg mb-2">
            Por empresa
          </p>
          <p className="text-muted-foreground/60 text-sm mb-10 max-w-md mx-auto">
            Vagas limitadas • Curadoria obrigatória
          </p>
          <Link to="/apply">
            <Button variant="hero" size="xl">
              Aplicar Agora
              <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Frase Final */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <blockquote className="text-2xl md:text-3xl font-display text-foreground italic">
              "UNV Growth Room é onde o crescimento deixa de ser confuso e passa a ser decidido."
            </blockquote>
          </div>
        </div>
      </section>
    </Layout>
  );
}
