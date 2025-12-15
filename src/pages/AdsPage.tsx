import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  Megaphone, 
  Shield, 
  MessageSquare, 
  Users,
  Target,
  FileText,
  BarChart3,
  Clock,
  Sparkles,
  TrendingUp,
  XCircle,
  AlertTriangle,
  Zap,
  UserCheck,
  Compass,
  Bot,
  LineChart,
  Settings,
  Layers,
  PenTool,
  Link2,
  RefreshCw
} from "lucide-react";
import { ProductTrailSummary } from "@/components/ProductTrailSummary";
import logoAds from "@/assets/logo-ads.png";

// Papel da UNV
const papelUNV = [
  { icon: Compass, text: "Diretor de aquisição (Demand & Acquisition)" },
  { icon: Link2, text: "Integrador marketing ↔ vendas" },
  { icon: Megaphone, text: "Curador de canais e mensagens" },
  { icon: Shield, text: "Guardião da qualidade de lead" },
  { icon: Settings, text: "Ajustador de volume vs. capacidade do time" },
];

// ICP - Quem é cliente ideal
const icpIdeal = [
  "Empresas faturando R$ 100k a R$ 1M+/mês",
  "Oferta validada",
  "Time comercial ativo",
  "Precisam gerar leads de forma previsível",
  "Querem escalar demanda com controle",
  "Querem parar de desperdiçar mídia",
];

const perfilIdeal = [
  "Entendem que tráfego sem processo é prejuízo",
  "Abertos a ajustes de funil e discurso",
  "Dispostos a alinhar marketing e vendas",
];

// Quem NÃO entra
const icpNao = [
  "Empresas sem time comercial",
  "Quem quer lead barato sem estrutura",
  "Quem quer 'viral'",
  "Quem quer tráfego sem responsabilidade",
];

// Formato
const formato = [
  { label: "Tipo", value: "Produto recorrente" },
  { label: "Contrato mínimo", value: "3 a 6 meses" },
  { label: "Gestão", value: "Contínua de mídia + estratégia" },
  { label: "Integração", value: "Sales Acceleration e Control" },
];

// Pilares de entrega
const pilares = [
  {
    numero: "1",
    titulo: "Diagnóstico de Demanda & Funil",
    icon: BarChart3,
    descricao: "Antes de rodar tráfego, a UNV Ads entende onde o lead entra e como ele vira venda.",
    oQueUNVFaz: [
      "Analisa funil comercial existente",
      "Avalia discurso de vendas",
      "Identifica gargalos de conversão",
      "Define ponto ideal de entrada de leads",
    ],
    entregaveis: [
      "Mapa de funil de aquisição",
      "Definição de lead ideal (MQL/SQL)",
      "Volume recomendado de leads/mês",
    ],
    ganho: "Eu paro de jogar dinheiro fora em mídia.",
  },
  {
    numero: "2",
    titulo: "Estratégia de Aquisição",
    icon: Target,
    descricao: "Definição clara de como e onde captar demanda.",
    canais: [
      "Meta Ads (Instagram/Facebook)",
      "Google Ads (Search/Display/YouTube)",
      "LinkedIn Ads (B2B)",
      "Remarketing estratégico",
    ],
    oQueUNVDefine: [
      "Canais prioritários",
      "Orçamento por canal",
      "Objetivo por campanha",
      "Métricas corretas (além de CPL)",
    ],
    entregaveis: [
      "Plano de mídia mensal",
      "Estrutura de campanhas",
      "KPIs de aquisição alinhados a vendas",
    ],
    ganho: "Meu tráfego tem estratégia, não achismo.",
  },
  {
    numero: "3",
    titulo: "Criação e Mensagem (Ads que Conversam com Vendas)",
    icon: PenTool,
    descricao: "Anúncios criados para vender, não para gerar curiosos.",
    oQueUNVTrabalha: [
      "Mensagem alinhada ao discurso comercial",
      "Criativos que filtram lead ruim",
      "Promessas compatíveis com a venda real",
      "Copy orientada a dor e decisão",
    ],
    entregaveis: [
      "Copies de anúncios",
      "Direcionamento de criativos (briefing)",
      "Testes de mensagens",
      "Ajustes contínuos",
    ],
    ganho: "Os leads chegam entendendo o que estão comprando.",
  },
  {
    numero: "4",
    titulo: "Geração de Leads Qualificados",
    icon: UserCheck,
    descricao: "Captação de leads com intenção real.",
    estrategias: [
      "Formulários inteligentes",
      "Perguntas qualificadoras",
      "Páginas focadas em conversão",
      "Conteúdos de decisão (não educativos demais)",
    ],
    entregaveis: [
      "Estrutura de captura",
      "Qualificação mínima no formulário",
      "Integração com o funil comercial",
    ],
    ganho: "Meu time para de perder tempo com curioso.",
  },
  {
    numero: "5",
    titulo: "Integração com o Comercial",
    icon: Link2,
    descricao: "Tráfego não anda sozinho.",
    oQueUNVGarante: [
      "Alinhamento com scripts de vendas",
      "Ajuste de volume conforme capacidade do time",
      "Feedback do comercial → tráfego",
      "Ajustes rápidos de rota",
    ],
    entregaveis: [
      "Rotina de alinhamento marketing/vendas",
      "Ajustes de campanha baseados em conversão",
      "Correção de mensagem conforme objeções reais",
    ],
    ganho: "Marketing e vendas finalmente falam a mesma língua.",
  },
  {
    numero: "6",
    titulo: "Otimização e Controle Contínuo",
    icon: RefreshCw,
    descricao: "Gestão contínua para melhorar eficiência.",
    oQueUNVFaz: [
      "Otimização de campanhas",
      "Corte de desperdícios",
      "Escala do que funciona",
      "Relatórios claros",
    ],
    entregaveis: [
      "Relatório mensal orientado a vendas",
      "Análise de custo por oportunidade",
      "Ajustes de escala com segurança",
    ],
    ganho: "Meu CAC começa a fazer sentido.",
  },
  {
    numero: "7",
    titulo: "UNV AI Advisor (Nível Ads)",
    icon: Bot,
    descricao: "Apoio à tomada de decisão entre tráfego e vendas.",
    oQueIAFaz: [
      "Organiza feedback do comercial",
      "Ajuda a priorizar testes",
      "Resume performance",
      "Apoia ajustes estratégicos",
    ],
    aviso: "Não executa campanhas. Ela ajuda a decidir melhor.",
    ganho: "Decisões mais rápidas e embasadas.",
  },
];

// Entregáveis consolidados
const entregaveisConsolidados = [
  "Diagnóstico de demanda",
  "Plano de mídia",
  "Estrutura de campanhas",
  "Copies e mensagens alinhadas",
  "Sistema de captação qualificada",
  "Integração marketing/vendas",
  "Relatórios orientados a vendas",
  "UNV AI Advisor (ads)",
];

// Ganhos
const ganhosImediatos = [
  { icon: UserCheck, text: "Leads mais qualificados" },
  { icon: Target, text: "Menos desperdício de mídia" },
  { icon: MessageSquare, text: "Melhor conversa do time" },
];

const ganhosEstruturais = [
  { icon: LineChart, text: "Demanda previsível" },
  { icon: BarChart3, text: "CAC mais controlado" },
  { icon: Link2, text: "Tráfego integrado ao negócio" },
];

// O que NÃO entrega
const naoEntrega = [
  "Não garante vendas",
  "Não promete CPL baixo",
  "Não trabalha sem alinhamento comercial",
  "Não substitui o time de vendas",
];

// Próximos produtos
const proximosProdutos = [
  { nome: "UNV Sales Acceleration", descricao: "Time preparado para converter", href: "/sales-acceleration" },
  { nome: "UNV Control", descricao: "Execução constante", href: "/control" },
  { nome: "UNV Growth Room", descricao: "Decisão de escala", href: "/growth-room" },
];

export default function AdsPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="container-premium relative z-10 py-20">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <div className="inline-block p-3 bg-white/95 rounded-xl shadow-lg mb-6">
              <img src={logoAds} alt="UNV Ads" className="h-16 md:h-20" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary text-sm font-medium rounded-full mb-6 backdrop-blur-sm border border-primary/30">
              <Megaphone className="h-4 w-4" />
              Sales-Driven Traffic & Demand Generation
            </div>
            <p className="text-2xl md:text-3xl text-foreground/90 font-medium mb-4">
              Tráfego que respeita o comercial — e não o contrário.
            </p>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Geração de demanda qualificada, operando totalmente conectada ao comercial, 
              com foco em vendas reais, não apenas em leads.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
        color="green"
        productNumber={7}
        productName="UNV ADS"
        tagline="Demand Generation"
        whatItDoes="Gera demanda qualificada, alinhada ao comercial."
        keyPoints={[
          "Estratégia de aquisição",
          "Tráfego com intenção de venda",
          "Leads qualificados",
          "Integração marketing ↔ vendas",
          "Otimização contínua"
        ]}
        arrow="Tráfego que respeita o comercial."
        targetAudience={{
          revenue: "R$ 100k a R$ 1M+/mês",
          team: "Com time preparado para atender"
        }}
        schedule={[
          { period: "Inicial", description: "Diagnóstico de funil" },
          { period: "Mensal", description: "Plano de mídia" },
          { period: "Contínuo", description: "Otimização" }
        ]}
        scheduleType="recurring"
      />

      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="heading-section text-foreground mb-6">
                Posicionamento Oficial
              </h2>
              <p className="text-body text-lg max-w-3xl mx-auto">
                A UNV Ads é a vertical da UNV responsável por geração de demanda qualificada, 
                operando totalmente conectada ao comercial, com foco em vendas reais, não apenas em leads.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="card-premium p-6 bg-accent/5 border-accent/20">
                <p className="text-foreground font-medium text-lg">
                  📌 A UNV Ads não existe para "rodar anúncios". 
                  Ela existe para alimentar o funil certo, no ritmo certo, para o time certo.
                </p>
              </div>
              <div className="card-premium p-6">
                <p className="text-muted-foreground">
                  Não é agência tradicional. Não é mídia desconectada do comercial. 
                  É <span className="text-foreground font-semibold">tráfego com responsabilidade de negócio.</span>
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
              O Papel da UNV na UNV Ads
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
                  ⚠️ A UNV não garante vendas, não promete ROI fixo e não substitui o comercial.
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
                  <p className="text-sm font-medium text-muted-foreground mb-3">Perfil Ideal:</p>
                  <ul className="space-y-2">
                    {perfilIdeal.map((item, i) => (
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
              Formato, Duração e Governança
            </h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              Objetivo Central da UNV Ads
            </h2>
            <p className="text-xl text-foreground mb-8 max-w-3xl mx-auto">
              Gerar demanda qualificada, no volume certo, para acelerar vendas sem colapsar o comercial.
            </p>
            
            <p className="text-muted-foreground mb-6">A UNV Ads trabalha sempre equilibrando:</p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
              {[
                "Volume de leads",
                "Qualidade de leads",
                "Capacidade do time",
                "Conversão real",
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

      {/* Estrutura de Entrega - 7 Pilares */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-5xl mx-auto">
            <h2 className="heading-section text-foreground text-center mb-4">
              Estrutura de Entrega — Nível Máximo
            </h2>
            <p className="text-body text-center mb-12 max-w-2xl mx-auto">
              7 pilares que garantem tráfego com responsabilidade de negócio.
            </p>

            <div className="space-y-6">
              {pilares.map((pilar, i) => (
                <div key={i} className="card-premium p-6 lg:p-8 bg-background">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <pilar.icon className="h-7 w-7 text-accent" />
                    </div>
                    <div>
                      <p className="text-accent font-bold text-sm uppercase tracking-wider mb-1">
                        Pilar {pilar.numero}
                      </p>
                      <h3 className="font-semibold text-foreground text-xl">
                        {pilar.titulo}
                      </h3>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6">
                    <div>
                      <p className="text-foreground mb-4">{pilar.descricao}</p>
                      
                      {pilar.oQueUNVFaz && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">O que a UNV faz:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.oQueUNVFaz.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.oQueUNVDefine && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">O que a UNV define:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.oQueUNVDefine.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.oQueUNVTrabalha && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">A UNV trabalha:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.oQueUNVTrabalha.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.oQueUNVGarante && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">A UNV garante:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.oQueUNVGarante.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.oQueIAFaz && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">O que a IA faz:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.oQueIAFaz.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.canais && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">Canais trabalhados:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.canais.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <Megaphone className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.estrategias && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">Estratégias usadas:</p>
                          <ul className="space-y-2 mb-4">
                            {pilar.estrategias.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {pilar.aviso && (
                        <p className="text-sm text-muted-foreground/80 italic mt-4">
                          ⚠️ {pilar.aviso}
                        </p>
                      )}
                    </div>

                    <div>
                      {pilar.entregaveis && (
                        <>
                          <p className="text-sm font-medium text-muted-foreground mb-3">Entregáveis:</p>
                          <ul className="space-y-2 mb-6">
                            {pilar.entregaveis.map((item, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm">
                                <FileText className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                                <span className="text-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Ganho percebido:</p>
                        <p className="text-foreground italic">"{pilar.ganho}"</p>
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
              Ganhos Reais da UNV Ads
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Ganhos Imediatos */}
              <div className="card-premium p-6 bg-background">
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

              {/* Ganhos Estruturais */}
              <div className="card-premium p-6 bg-background">
                <h3 className="font-semibold text-foreground text-lg mb-6 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Ganhos Estruturais
                </h3>
                <div className="space-y-4">
                  {ganhosEstruturais.map((item, i) => (
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
              O Que a UNV Ads NÃO Entrega
            </h2>
            <p className="text-body text-center mb-8">
              👉 Ela alimenta o motor certo.
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
              Caminho Natural com a UNV Ads
            </h2>
            <p className="text-body text-center mb-12">
              A UNV Ads funciona melhor quando combinada com:
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
          <h2 className="heading-section text-foreground mb-6">Investimento (Referência)</h2>
          <p className="text-3xl md:text-4xl font-display font-bold text-primary mb-2">
            R$ 1.500 a R$ 4.000
          </p>
          <p className="text-muted-foreground text-lg mb-2">
            Por mês (conforme investimento em ads)
          </p>
          <p className="text-muted-foreground/60 text-sm mb-4">
            + Mídia paga: investimento do cliente
          </p>
          <p className="text-muted-foreground/60 text-sm mb-10 max-w-md mx-auto">
            Contrato mínimo recomendado
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
              "UNV Ads é tráfego que respeita o comercial — e não o contrário."
            </blockquote>
          </div>
        </div>
      </section>
    </Layout>
  );
}
